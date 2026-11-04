-- Mises à jour depuis nos Paramètres : dernière publication du dépôt GitHub, téléchargement du .star,
-- vérification de son empreinte SHA-256, remplacement du fichier du plugin (l'ancien est gardé de côté
-- pour pouvoir y revenir). Le frontend relance ensuite le plugin dans Millennium et recharge l'interface.
-- Les réglages ne sont pas touchés : ils vivent dans la configuration de Millennium, pas dans le .star.

local http   = require("http")
local cjson  = require("json")
local fs     = require("fs")
local logger = require("logger")

local REPO = "venaciteam/steam-upgraded"
local STAR = "com.venacity.steamupgraded.star"
local DOWNLOAD_PREFIX = "https://github.com/" .. REPO .. "/releases/download/"

-- Un .star commence par « R », 19, 0, 0, puis « MILLENNIUM » à l'octet 7 (format de Millennium)
local function is_star(data)
    return type(data) == "string" and data:sub(7, 16) == "MILLENNIUM"
end

local function encode(t)
    local ok, out = pcall(cjson.encode, t)
    if ok then return out end
    return '{"ok":false,"error":"encodage impossible"}'
end

local function fail(msg) return encode({ ok = false, error = msg }) end

local function str(v)
    if v == nil or v == cjson.null then return nil end
    return tostring(v)
end

-- ---------- Windows : téléchargement binaire et SHA-256 (FFI LuaJIT) ----------

-- Le module http coupe une réponse au premier octet nul (voir sgdb.lua) : le .star passe par urlmon.
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

local function download(url)
    if not (win and win.urlmon) then return nil, "téléchargement indisponible sur ce système" end
    local ffi = win.ffi
    local buf = ffi.new("char[?]", 520)
    local n = ffi.C.GetTempPathA(520, buf)
    if n == 0 then return nil, "dossier temporaire introuvable" end
    local path = ffi.string(buf, n) .. "steamupgraded-maj-" .. tostring(os.time()) .. ".star"
    local hr = tonumber(win.urlmon.URLDownloadToFileA(nil, url, path, 0, nil))
    if hr ~= 0 then
        os.remove(path)
        return nil, string.format("erreur 0x%08X", hr % 4294967296)
    end
    local f = io.open(path, "rb")
    if not f then return nil, "fichier téléchargé illisible" end
    local data = f:read("*a")
    f:close()
    os.remove(path)
    return data
end

local function sha256(data)
    if not (win and win.bcrypt) then return nil end
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

local function read_file(path)
    local f = io.open(path, "rb")
    if not f then return nil end
    local data = f:read("*a")
    f:close()
    return data
end

local function write_file(path, data)
    local f, err = io.open(path, "wb")
    if not f then return false, err end
    local ok, werr = f:write(data)
    f:close()
    if not ok then return false, werr end
    return true
end

-- ---------- Chemins ----------

-- Le chemin du plugin vient de Millennium (Core_FindAllPlugins) : seul notre fichier, dans un dossier de Millennium, est accepté.
local function plugin_path_ok(path)
    local norm = tostring(path or ""):gsub("\\", "/"):lower()
    return norm:sub(-#STAR - 1) == "/" .. STAR and norm:find("/millennium/", 1, true) ~= nil
end

-- Version précédente gardée à côté du dossier des plugins (dans « millennium »), pour que Millennium ne la charge pas.
local function previous_paths(path)
    local dir = tostring(path):gsub("[/\\][^/\\]+[/\\][^/\\]+$", "")
    return dir .. "/steam-upgraded-precedente.star", dir .. "/steam-upgraded-precedente.json"
end

-- ---------- Fonctions appelées par le frontend ----------

---@ffi
---Dernière publication du dépôt : version, notes (partie française), fichier .star et son empreinte.
---@return string
function sp_update_latest()
    local ok, res, err = pcall(http.get, "https://api.github.com/repos/" .. REPO .. "/releases/latest", {
        timeout = 20,
        user_agent = "steam-upgraded",
        headers = { ["Accept"] = "application/vnd.github+json" },
    })
    if not ok then return fail(tostring(res)) end
    if not res then return fail(err or "GitHub injoignable") end
    if res.status ~= 200 then return fail("GitHub a répondu " .. tostring(res.status)) end
    local dok, rel = pcall(cjson.decode, res.body)
    if not dok or type(rel) ~= "table" then return fail("réponse de GitHub illisible") end
    local star = nil
    if type(rel.assets) == "table" then
        for _, a in ipairs(rel.assets) do
            if type(a) == "table" and a.name == STAR then star = a end
        end
    end
    local notes = str(rel.body) or ""
    -- Les notes sont en français puis en anglais, séparées par une ligne « --- »
    local cut = notes:find("\r?\n%-%-%-\r?\n")
    if cut then notes = notes:sub(1, cut - 1) end
    local digest = star and str(star.digest)
    return encode({
        ok = true,
        tag = str(rel.tag_name),
        name = str(rel.name),
        published = str(rel.published_at),
        url = str(rel.html_url),
        notes = notes,
        star = star and str(star.browser_download_url) or nil,
        size = star and tonumber(star.size) or nil,
        sha256 = digest and digest:match("^sha256:(%x+)$") or nil,
    })
end

---@ffi
---Télécharge le .star de la publication, vérifie son empreinte, garde l'ancien de côté et le remplace.
---@param path string Chemin du plugin installé (Core_FindAllPlugins)
---@param url string Adresse du .star (sp_update_latest)
---@param hash string Empreinte SHA-256 attendue
---@param current string Version installée (retenue pour « revenir à la version précédente »)
---@return string
function sp_update_install(path, url, hash, current)
    path, url, hash = tostring(path or ""), tostring(url or ""), tostring(hash or ""):lower()
    if not plugin_path_ok(path) then return fail("Chemin du plugin inattendu.") end
    if url:sub(1, #DOWNLOAD_PREFIX) ~= DOWNLOAD_PREFIX or url:sub(-#STAR) ~= STAR then return fail("Adresse de téléchargement refusée.") end
    if not hash:match("^%x+$") or #hash ~= 64 then return fail("Empreinte du fichier absente : mise à jour refusée par prudence.") end

    local ok, data, err = pcall(download, url)
    if not ok then data, err = nil, tostring(data) end
    if not data or #data == 0 then return fail("Téléchargement impossible (" .. tostring(err or "fichier vide") .. ").") end
    local got = sha256(data)
    if not got then return fail("Vérification de l'empreinte impossible sur ce système.") end
    if got ~= hash then return fail("Le fichier téléchargé ne correspond pas à la publication (empreinte différente). Rien n'a été modifié.") end
    if not is_star(data) then return fail("Le fichier téléchargé n'est pas un plugin valide. Rien n'a été modifié.") end

    local old = read_file(path)
    if not old then return fail("Le plugin installé est illisible.") end
    local prev_star, prev_json = previous_paths(path)
    local saved, serr = write_file(prev_star, old)
    if not saved then return fail("Impossible de garder la version actuelle de côté (" .. tostring(serr) .. "). Rien n'a été modifié.") end
    write_file(prev_json, encode({ version = str(current) }))

    local wrote, werr = write_file(path, data)
    if not wrote then
        write_file(path, old)
        return fail("Remplacement du plugin impossible (" .. tostring(werr) .. "). La version actuelle est remise en place.")
    end
    logger:info("Mise à jour installée (" .. #data .. " octets), version précédente gardée de côté")
    return encode({ ok = true })
end

---@ffi
---Version gardée de côté par la dernière mise à jour, s'il y en a une.
---@param path string
---@return string
function sp_update_previous(path)
    if not plugin_path_ok(path) then return encode({ ok = true }) end
    local prev_star, prev_json = previous_paths(path)
    if not fs.exists(prev_star) then return encode({ ok = true }) end
    local meta = read_file(prev_json)
    local dok, m = pcall(cjson.decode, meta or "")
    return encode({ ok = true, version = dok and type(m) == "table" and str(m.version) or "précédente" })
end

---@ffi
---Remet la version gardée de côté à la place du plugin actuel.
---@param path string
---@return string
function sp_update_rollback(path)
    path = tostring(path or "")
    if not plugin_path_ok(path) then return fail("Chemin du plugin inattendu.") end
    local prev_star, prev_json = previous_paths(path)
    local data = read_file(prev_star)
    if not is_star(data) then return fail("Aucune version précédente valide n'a été gardée.") end
    local current = read_file(path)
    local wrote, werr = write_file(path, data)
    if not wrote then
        if current then write_file(path, current) end
        return fail("Remplacement du plugin impossible (" .. tostring(werr) .. ").")
    end
    fs.remove(prev_star)
    fs.remove(prev_json)
    logger:info("Retour à la version précédente du plugin")
    return encode({ ok = true })
end
