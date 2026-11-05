-- Téléchargement d'un fichier binaire et empreinte SHA-256, sur toutes les plateformes.
-- Le module http de Millennium coupe le corps d'une réponse au premier octet nul : inutilisable pour un .star ou une image.
-- Windows : urlmon et bcrypt (FFI LuaJIT), en place depuis la 0.1.0.
-- Ailleurs (macOS, Linux) : http.download (Millennium 3.6 et plus) écrit le fichier sur le disque, relu ensuite en binaire ;
-- SHA-256 calculé en Lua (opérations bit de LuaJIT).

local http = require("http")
local bit  = require("bit")

local M = {}

local win = nil
do
    local ok_ffi, ffi = pcall(require, "ffi")
    if ok_ffi and ffi.os == "Windows" then
        pcall(ffi.cdef, [[
            long __stdcall URLDownloadToFileA(void *caller, const char *url, const char *file, unsigned long reserved, void *cb);
            unsigned long __stdcall GetTempPathA(unsigned long len, char *buf);
            long __stdcall BCryptOpenAlgorithmProvider(void **phAlgorithm, const uint16_t *pszAlgId, const uint16_t *pszImplementation, unsigned long dwFlags);
            long __stdcall BCryptHash(void *hAlgorithm, unsigned char *pbSecret, unsigned long cbSecret, const unsigned char *pbInput, unsigned long cbInput, unsigned char *pbOutput, unsigned long cbOutput);
            long __stdcall BCryptCloseAlgorithmProvider(void *hAlgorithm, unsigned long dwFlags);
        ]])
        local ok_u, urlmon = pcall(ffi.load, "urlmon")
        local ok_b, bcrypt = pcall(ffi.load, "bcrypt")
        win = { ffi = ffi, urlmon = ok_u and urlmon or nil, bcrypt = ok_b and bcrypt or nil }
    end
end

local function read_and_remove(path)
    local f = io.open(path, "rb")
    if not f then
        os.remove(path)
        return nil, "fichier téléchargé illisible"
    end
    local data = f:read("*a")
    f:close()
    os.remove(path)
    return data
end

local function temp_dir()
    local d = os.getenv("TMPDIR") or os.getenv("TMP") or os.getenv("TEMP") or "/tmp"
    if d:sub(-1) ~= "/" and d:sub(-1) ~= "\\" then d = d .. "/" end
    return d
end

---Télécharge `url` et renvoie son contenu binaire, ou nil et un message.
---@param url string
---@param tag string préfixe du fichier temporaire
function M.download(url, tag)
    local name = "steamupgraded-" .. tag .. "-" .. tostring(os.time()) .. "-" .. tostring(math.random(100000, 999999))
    if win then
        if not win.urlmon then return nil, "téléchargement indisponible sur ce système" end
        local ffi = win.ffi
        local buf = ffi.new("char[?]", 520)
        local n = ffi.C.GetTempPathA(520, buf)
        if n == 0 then return nil, "dossier temporaire introuvable" end
        local path = ffi.string(buf, n) .. name
        local hr = tonumber(win.urlmon.URLDownloadToFileA(nil, url, path, 0, nil))
        if hr ~= 0 then
            os.remove(path)
            return nil, string.format("erreur 0x%08X", hr % 4294967296)
        end
        return read_and_remove(path)
    end
    if type(http.download) ~= "function" then return nil, "téléchargement indisponible (Millennium trop ancien)" end
    local path = temp_dir() .. name
    local ok, res, err = pcall(http.download, url, path, { timeout = 60 })
    if not ok then
        os.remove(path)
        return nil, tostring(res)
    end
    if not res then
        os.remove(path)
        return nil, tostring(err or "échec du téléchargement")
    end
    if not res.success or (res.status and res.status >= 400) then
        os.remove(path)
        return nil, "erreur HTTP " .. tostring(res.status or "?")
    end
    return read_and_remove(path)
end

-- ---------- SHA-256 ----------

local band, bnot, bxor, rshift, ror, tobit, tohex = bit.band, bit.bnot, bit.bxor, bit.rshift, bit.ror, bit.tobit, bit.tohex

local K = {
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
}
for i = 1, 64 do K[i] = tobit(K[i]) end

local function sha256_lua(msg)
    local len = #msg
    local pad = (64 - (len + 9) % 64) % 64
    local bits = len * 8
    local hi, lo = math.floor(bits / 4294967296), bits % 4294967296
    msg = msg .. "\128" .. string.rep("\0", pad) .. string.char(
        band(rshift(hi, 24), 255), band(rshift(hi, 16), 255), band(rshift(hi, 8), 255), band(hi, 255),
        band(rshift(lo, 24), 255), band(rshift(lo, 16), 255), band(rshift(lo, 8), 255), band(lo, 255))

    local H = { tobit(0x6a09e667), tobit(0xbb67ae85), tobit(0x3c6ef372), tobit(0xa54ff53a),
                tobit(0x510e527f), tobit(0x9b05688c), tobit(0x1f83d9ab), tobit(0x5be0cd19) }
    local w = {}
    local byte = string.byte
    for chunk = 1, #msg, 64 do
        for i = 0, 15 do
            local b1, b2, b3, b4 = byte(msg, chunk + i * 4, chunk + i * 4 + 3)
            w[i] = tobit(b1 * 16777216 + b2 * 65536 + b3 * 256 + b4)
        end
        for i = 16, 63 do
            local w15, w2 = w[i - 15], w[i - 2]
            local s0 = bxor(ror(w15, 7), ror(w15, 18), rshift(w15, 3))
            local s1 = bxor(ror(w2, 17), ror(w2, 19), rshift(w2, 10))
            w[i] = tobit(w[i - 16] + s0 + w[i - 7] + s1)
        end
        local a, b, c, d, e, f, g, h = H[1], H[2], H[3], H[4], H[5], H[6], H[7], H[8]
        for i = 0, 63 do
            local S1 = bxor(ror(e, 6), ror(e, 11), ror(e, 25))
            local ch = bxor(band(e, f), band(bnot(e), g))
            local t1 = tobit(h + S1 + ch + K[i + 1] + w[i])
            local S0 = bxor(ror(a, 2), ror(a, 13), ror(a, 22))
            local maj = bxor(band(a, b), band(a, c), band(b, c))
            local t2 = tobit(S0 + maj)
            h, g, f, e, d, c, b, a = g, f, e, tobit(d + t1), c, b, a, tobit(t1 + t2)
        end
        H[1], H[2], H[3], H[4] = tobit(H[1] + a), tobit(H[2] + b), tobit(H[3] + c), tobit(H[4] + d)
        H[5], H[6], H[7], H[8] = tobit(H[5] + e), tobit(H[6] + f), tobit(H[7] + g), tobit(H[8] + h)
    end
    local out = {}
    for i = 1, 8 do out[i] = tohex(H[i], 8) end
    return table.concat(out)
end

---Empreinte SHA-256 (hexadécimal minuscule) de `data`, ou nil.
---@param data string
function M.sha256(data)
    if win then
        if not win.bcrypt then return nil end
        local ffi = win.ffi
        local alg = ffi.new("void*[1]")
        local name = ffi.new("uint16_t[7]", { 83, 72, 65, 50, 53, 54, 0 }) -- "SHA256" en UTF-16
        if win.bcrypt.BCryptOpenAlgorithmProvider(alg, name, nil, 0) ~= 0 then return nil end
        local out = ffi.new("unsigned char[32]")
        local st = win.bcrypt.BCryptHash(alg[0], nil, 0, data, #data, out, 32)
        win.bcrypt.BCryptCloseAlgorithmProvider(alg[0], 0)
        if st ~= 0 then return nil end
        local hex = {}
        for i = 0, 31 do hex[#hex + 1] = string.format("%02x", out[i]) end
        return table.concat(hex)
    end
    return sha256_lua(data)
end

M._sha256_lua = sha256_lua

return M
