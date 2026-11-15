-- Téléchargement d'un fichier binaire et empreinte SHA-256, sur toutes les plateformes.
-- Le module http de Millennium coupe le corps d'une réponse au premier octet nul : inutilisable pour un .star ou une image.
-- Téléchargement : http.download (Millennium 3.6 et plus) écrit le fichier sur le disque, relu ensuite en binaire, avec un
-- délai maximal (le backend ne traite rien d'autre pendant un téléchargement). Windows avec un Millennium plus ancien :
-- urlmon (FFI LuaJIT, en place depuis la 0.1.0), synchrone et sans délai réglable (seuls ceux de WinINet s'appliquent).
-- SHA-256 : bcrypt sous Windows, calculé en Lua ailleurs (opérations bit de LuaJIT).

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
        pcall(ffi.cdef, [[
            unsigned long __stdcall GetTempPathW(unsigned long len, uint16_t *buf);
            unsigned long __stdcall GetShortPathNameW(const uint16_t *longPath, uint16_t *shortPath, unsigned long len);
            int __stdcall WideCharToMultiByte(unsigned int codePage, unsigned long flags, const uint16_t *wide, int wideLen, char *out, int outLen, const char *defaultChar, int *usedDefaultChar);
        ]])
        pcall(ffi.cdef, [[
            unsigned int __stdcall GetACP(void);
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

local DOWNLOAD_TIMEOUT = 180 -- secondes, téléchargement complet (archive de Millennium, visuels animés de plus de 8 Mo)

local function temp_dir()
    local d = os.getenv("TMPDIR") or os.getenv("TMP") or os.getenv("TEMP") or "/tmp"
    if d:sub(-1) ~= "/" and d:sub(-1) ~= "\\" then d = d .. "/" end
    return d
end

-- Windows : io.open, os.remove, URLDownloadToFileA et le fopen de http.download lisent les chemins dans la page de
-- code ANSI. Un nom de compte qui en sort (ex. cyrillique ou chinois sur un Windows français) donnerait un chemin faux :
-- le dossier temporaire est lu en UTF-16 puis pris sous son nom court 8.3 quand il existe. S'il ne s'écrit toujours
-- pas dans la page de code, refus explicite plutôt qu'un fichier écrit ailleurs.
-- Page de code ANSI UTF-8 (65001, option « Bêta : Unicode UTF-8 » de Windows) : WideCharToMultiByte y exige des
-- options 0 ou WC_ERR_INVALID_CHARS et lpUsedDefaultChar NULL, sinon il échoue ; tout chemin UTF-16 valide s'y écrit.
local function win_temp_dir()
    local ffi = win.ffi
    local lossy = false -- caractère absent de la page de code : la lecture ANSI le remplacerait aussi (« ? » ou voisin)
    local ok, dir = pcall(function()
        local long = ffi.new("uint16_t[?]", 1024)
        local n = tonumber(ffi.C.GetTempPathW(1024, long))
        if n == 0 or n >= 1024 then return nil end
        local short = ffi.new("uint16_t[?]", 1024)
        local s = tonumber(ffi.C.GetShortPathNameW(long, short, 1024))
        local wide = (s > 0 and s < 1024) and short or long
        local out = ffi.new("char[?]", 2048)
        local ok_acp, acp = pcall(function() return tonumber(ffi.C.GetACP()) end)
        if ok_acp and acp == 65001 then
            -- CP_UTF8, WC_ERR_INVALID_CHARS : échec plutôt qu'un U+FFFD à la place d'un UTF-16 invalide
            local m = tonumber(ffi.C.WideCharToMultiByte(65001, 0x80, wide, -1, out, 2048, nil, nil))
            if m == 0 then return nil end
            return ffi.string(out)
        end
        local used = ffi.new("int[1]")
        -- CP_ACP, WC_NO_BEST_FIT_CHARS : aucun caractère remplacé par un voisin
        local m = tonumber(ffi.C.WideCharToMultiByte(0, 0x400, wide, -1, out, 2048, nil, used))
        if m == 0 then return nil end
        if used[0] ~= 0 then
            lossy = true
            return nil
        end
        return ffi.string(out)
    end)
    if (not ok or dir == nil) and not lossy then
        -- Fonctions UTF-16 indisponibles ou conversion en échec : ancienne lecture ANSI, refusée si Windows y a remplacé
        -- des caractères par « ? ». Pas de repli quand un caractère manque à la page de code : GetTempPathA le
        -- remplacerait par « ? » ou par un voisin (best fit, ex. « Ł » en « L »), donc un autre dossier.
        ok, dir = pcall(function()
            local buf = ffi.new("char[?]", 520)
            local n = tonumber(ffi.C.GetTempPathA(520, buf))
            if n == 0 or n >= 520 then return nil end
            return ffi.string(buf, n)
        end)
        if ok and type(dir) == "string" and dir:find("?", 1, true) then dir = nil end
    end
    if not ok or type(dir) ~= "string" or dir == "" then return nil end
    if dir:sub(-1) ~= "\\" and dir:sub(-1) ~= "/" then dir = dir .. "\\" end
    return dir
end

---Télécharge `url` et renvoie son contenu binaire, ou nil et un message.
---@param url string
---@param tag string préfixe du fichier temporaire
function M.download(url, tag)
    local name = "steamupgraded-" .. tag .. "-" .. tostring(os.time()) .. "-" .. tostring(math.random(100000, 999999))
    local dir = temp_dir()
    if win then
        dir = win_temp_dir()
        if not dir then return nil, "dossier temporaire au nom non pris en charge" end
    end
    local path = dir .. name
    local ok, res, err = false, "téléchargement indisponible (Millennium trop ancien)", nil
    if type(http.download) == "function" then
        ok, res, err = pcall(http.download, url, path, { timeout = DOWNLOAD_TIMEOUT })
    end
    if not ok and win then
        -- Millennium sans http.download (ou appel refusé) : urlmon, seul moyen sous Windows jusqu'à la 0.2.6
        os.remove(path)
        if not win.urlmon then return nil, "téléchargement indisponible sur ce système" end
        local hr = tonumber(win.urlmon.URLDownloadToFileA(nil, url, path, 0, nil))
        if hr ~= 0 then
            os.remove(path)
            return nil, string.format("erreur 0x%08X", hr % 4294967296)
        end
        return read_and_remove(path)
    end
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
