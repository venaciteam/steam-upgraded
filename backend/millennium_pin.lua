-- Millennium figé : chaque version de Steam Upgraded est testée avec UNE version de Millennium (millennium.lock.json,
-- à la racine du dépôt). Le frontend compare la version qui tourne à la version testée, coupe les mises à jour
-- automatiques de Millennium et, sous Windows, installe la version testée par le programme de mise à jour de Millennium
-- (Core_UpdateMillennium), après avoir vérifié ici l'empreinte de l'archive.

local http       = require("http")
local cjson      = require("json")
local millennium = require("millennium")
local binary     = require("binary")

local REPO = "venaciteam/steam-upgraded"
local MILLENNIUM_DOWNLOADS = "https://github.com/SteamClientHomebrew/Millennium/releases/download/"

local function encode(t)
    local ok, out = pcall(cjson.encode, t)
    if ok then return out end
    return '{"ok":false,"error":"encodage impossible"}'
end

local function fail(msg) return encode({ ok = false, error = msg }) end

local function platform()
    local ok, ffi = pcall(require, "ffi")
    local os_name = ok and ffi.os or ""
    if os_name == "Windows" then return "windows" end
    if os_name == "OSX" then return "macos" end
    if os_name == "Linux" then return "linux" end
    return "inconnue"
end

---@ffi
---Version de Millennium qui fait tourner le plugin, et plateforme (windows, macos, linux).
---@return string
function sp_millennium_running()
    local ok, v = pcall(millennium.version)
    return encode({ ok = true, version = ok and tostring(v or ""):gsub("^v", "") or "", platform = platform() })
end

---@ffi
---millennium.lock.json d'une publication de Steam Upgraded (lu dans le dépôt, à l'étiquette de la publication).
---@param tag string Étiquette de la publication, ex. v0.1.2
---@return string
function sp_millennium_lock(tag)
    tag = tostring(tag or "")
    if not tag:match("^v%d+%.%d+%.%d+$") then return fail("Étiquette de publication inattendue.") end
    local url = "https://raw.githubusercontent.com/" .. REPO .. "/" .. tag .. "/millennium.lock.json"
    local ok, res, err = pcall(http.get, url, { timeout = 20, user_agent = "steam-upgraded" })
    if not ok then return fail(tostring(res)) end
    if not res then return fail(tostring(err or "GitHub injoignable")) end
    -- Publications antérieures au figeage : pas de fichier, rien à imposer
    if res.status == 404 then return encode({ ok = true, absent = true }) end
    if res.status ~= 200 then return fail("GitHub a répondu " .. tostring(res.status)) end
    local dok, lock = pcall(cjson.decode, res.body or "")
    if not dok or type(lock) ~= "table" or type(lock.version) ~= "string" then return fail("millennium.lock.json illisible") end
    return encode({ ok = true, lock = lock })
end

---@ffi
---Télécharge une archive officielle de Millennium et vérifie son empreinte, avant de la confier à Millennium.
---@param url string
---@param hash string SHA-256 attendu
---@return string
function sp_millennium_verify(url, hash)
    url, hash = tostring(url or ""), tostring(hash or ""):lower()
    if url:sub(1, #MILLENNIUM_DOWNLOADS) ~= MILLENNIUM_DOWNLOADS then return fail("Adresse de Millennium refusée.") end
    if not hash:match("^%x+$") or #hash ~= 64 then return fail("Empreinte de Millennium absente.") end
    local ok, data, err = pcall(binary.download, url, "millennium")
    if not ok then data, err = nil, tostring(data) end
    if not data or #data == 0 then return fail("Téléchargement de Millennium impossible (" .. tostring(err or "fichier vide") .. ").") end
    local got = binary.sha256(data)
    if not got then return fail("Vérification de l'empreinte impossible sur ce système.") end
    if got ~= hash then return fail("L'archive de Millennium ne correspond pas à la version testée (empreinte différente). Rien n'a été modifié.") end
    return encode({ ok = true, size = #data })
end
