-- Fonctions SteamGridDB : recherche du jeu, liste des visuels, téléchargement de l'image choisie.
-- Le frontend (dans Steam) ne peut pas appeler l'API en cross-origin : tout passe par ici.
-- Chaque fonction renvoie une chaîne JSON { ok = true, ... } ou { ok = false, error = "..." }.
-- La clé API n'est jamais journalisée et ne sert que dans l'en-tête Authorization.

local http   = require("http")
local cjson  = require("json") -- le module s'appelle « json » dans Millennium (implémentation cjson)
local logger = require("logger")
local binary = require("binary")

-- utils est chargé prudemment : un module absent ne doit pas faire tomber tout le backend.
local has_utils, utils = pcall(require, "utils")
if not has_utils or type(utils) ~= "table" then utils = {} end

local function trim(s)
    return (s:gsub("^%s+", ""):gsub("%s+$", ""))
end

local function url_encode(s)
    if utils.url_encode then return utils.url_encode(s) end
    return (s:gsub("[^%w%-_%.~]", function(c) return string.format("%%%02X", string.byte(c)) end))
end

-- Encodeur Lua pur : sûr pour les données binaires (octets nuls compris), par blocs pour rester rapide.
local B64 = {}
do
    local alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    for i = 1, 64 do B64[i - 1] = alphabet:byte(i) end
end
local unpack_ = unpack or table.unpack
local function base64_encode(data)
    local out, buf, k = {}, {}, 0
    local n, byte, floor = #data, string.byte, math.floor
    for i = 1, n, 3 do
        local a, b, c = byte(data, i, i + 2)
        local v = a * 65536 + (b or 0) * 256 + (c or 0)
        buf[k + 1] = B64[floor(v / 262144) % 64]
        buf[k + 2] = B64[floor(v / 4096) % 64]
        buf[k + 3] = b and B64[floor(v / 64) % 64] or 61
        buf[k + 4] = c and B64[v % 64] or 61
        k = k + 4
        if k >= 4096 then
            out[#out + 1] = string.char(unpack_(buf, 1, k))
            k = 0
        end
    end
    if k > 0 then out[#out + 1] = string.char(unpack_(buf, 1, k)) end
    return table.concat(out)
end

local BASE = "https://www.steamgriddb.com/api/v2"
local UA = "SteamPerso/0.1 (Millennium)"

-- Réglages par type de visuel : chemin de l'API, dimensions et formats acceptés par Steam.
-- Les formats webp et gif sont exclus : SetCustomArtworkForApp n'accepte que png et jpg.
-- Les animés restants sont donc des PNG animés (APNG).
local KINDS = {
    capsule = { path = "grids",  dimensions = "600x900,342x482,660x930", mimes = "image/png,image/jpeg" },
    header  = { path = "grids",  dimensions = "920x430,460x215",         mimes = "image/png,image/jpeg" },
    hero    = { path = "heroes", mimes = "image/png,image/jpeg" },
    logo    = { path = "logos",  mimes = "image/png" },
    icon    = { path = "icons",  mimes = "image/png" },
}

local function result(t)
    return cjson.encode(t)
end

local function fail(message, status)
    return result({ ok = false, error = message, status = status or 0 })
end

local function http_error(res, err)
    if not res then
        return "Impossible de joindre SteamGridDB (" .. tostring(err or "réseau") .. ")."
    end
    if res.status == 401 or res.status == 403 then
        return "Clé API refusée par SteamGridDB. Vérifiez-la dans Paramètres › SteamGridDB."
    end
    if res.status == 404 then
        return "Introuvable sur SteamGridDB."
    end
    if res.status == 429 then
        return "Trop de requêtes vers SteamGridDB, réessayez dans un instant."
    end
    return "SteamGridDB a répondu avec l'erreur " .. tostring(res.status) .. "."
end

-- Appel GET authentifié. Renvoie (data, nil, status) ou (nil, message, status).
local function api_get(key, path)
    if type(key) ~= "string" or key == "" then
        return nil, "Aucune clé API SteamGridDB.", 401
    end
    local res, err = http.get(BASE .. path, {
        headers = {
            ["Authorization"] = "Bearer " .. key,
            ["Accept"] = "application/json",
        },
        timeout = 20,
        user_agent = UA,
    })
    if not res or res.status ~= 200 then
        return nil, http_error(res, err), res and res.status or 0
    end
    local ok, body = pcall(cjson.decode, res.body or "")
    if not ok or type(body) ~= "table" then
        return nil, "Réponse illisible de SteamGridDB.", res.status
    end
    if body.success == false then
        local msg = type(body.errors) == "table" and body.errors[1] or nil
        return nil, "SteamGridDB : " .. tostring(msg or "erreur inconnue"), res.status
    end
    return body, nil, res.status
end

local function str(v)
    if v == nil or v == cjson.null then return nil end
    return tostring(v)
end

local function year_of(ts)
    if type(ts) ~= "number" or ts <= 0 then return nil end
    return tonumber(os.date("!%Y", ts))
end

local function game_info(g)
    return {
        id = g.id,
        name = str(g.name) or "",
        year = year_of(g.release_date),
        verified = g.verified == true,
    }
end

---@ffi
---Trouve le jeu SteamGridDB correspondant à un appid Steam.
---@param key string
---@param appid integer
---@return string
function sgdb_game(key, appid)
    local id = tonumber(appid)
    if not id then return fail("Identifiant de jeu invalide.") end
    local body, err, status = api_get(key, "/games/steam/" .. string.format("%d", id))
    if not body then
        if status == 404 then
            return fail("Ce jeu n'est pas encore référencé sur SteamGridDB.", 404)
        end
        return fail(err, status)
    end
    if type(body.data) ~= "table" then return fail("Ce jeu n'est pas encore référencé sur SteamGridDB.", 404) end
    return result({ ok = true, game = game_info(body.data) })
end

---@ffi
---Recherche de jeux par nom (« Ce n'est pas le bon jeu ? »).
---@param key string
---@param term string
---@return string
function sgdb_search(key, term)
    term = trim(tostring(term or ""))
    if term == "" then return result({ ok = true, games = {} }) end
    local body, err, status = api_get(key, "/search/autocomplete/" .. url_encode(term))
    if not body then return fail(err, status) end
    local games = {}
    for _, g in ipairs(type(body.data) == "table" and body.data or {}) do
        games[#games + 1] = game_info(g)
    end
    return result({ ok = true, games = games })
end

---@ffi
---Liste les visuels d'un jeu pour un emplacement donné.
---@param key string
---@param kind string capsule | header | hero | logo | icon
---@param game_id integer
---@param styles string styles séparés par des virgules, vide pour tous
---@param animated boolean true : uniquement les animés, false : uniquement les fixes
---@param page integer page (0 pour la première)
---@return string
function sgdb_assets(key, kind, game_id, styles, animated, page)
    local cfg = KINDS[kind]
    if not cfg then return fail("Type de visuel inconnu.") end
    local gid = tonumber(game_id)
    if not gid then return fail("Jeu SteamGridDB invalide.") end

    local q = {
        "nsfw=false",
        "humor=any",
        "epilepsy=any",
        "types=" .. (animated and "animated" or "static"),
        "mimes=" .. url_encode(cfg.mimes),
        "page=" .. string.format("%d", tonumber(page) or 0),
    }
    if cfg.dimensions then q[#q + 1] = "dimensions=" .. url_encode(cfg.dimensions) end
    if type(styles) == "string" and styles ~= "" then q[#q + 1] = "styles=" .. url_encode(styles) end

    local path = "/" .. cfg.path .. "/game/" .. string.format("%d", gid) .. "?" .. table.concat(q, "&")
    local body, err, status = api_get(key, path)
    if not body then return fail(err, status) end

    local items = {}
    for _, a in ipairs(type(body.data) == "table" and body.data or {}) do
        local author = type(a.author) == "table" and a.author or {}
        items[#items + 1] = {
            id = a.id,
            url = str(a.url),
            thumb = str(a.thumb) or str(a.url),
            mime = str(a.mime),
            width = tonumber(a.width) or 0,
            height = tonumber(a.height) or 0,
            style = str(a.style),
            author = str(author.name) or "Anonyme",
            upvotes = tonumber(a.upvotes) or 0,
            downvotes = tonumber(a.downvotes) or 0,
            animated = animated and true or false,
        }
    end
    return result({
        ok = true,
        items = items,
        page = tonumber(body.page) or 0,
        total = tonumber(body.total) or #items,
        limit = tonumber(body.limit) or 50,
    })
end

-- Seuls les fichiers servis par SteamGridDB sont téléchargés.
local function allowed_url(url)
    if type(url) ~= "string" then return false end
    local host = url:match("^https://([^/:?#]+)")
    if not host then return false end
    host = host:lower()
    return host == "steamgriddb.com" or host:sub(-#".steamgriddb.com") == ".steamgriddb.com"
end

local function detect_format(bytes)
    if bytes:sub(1, 8) == "\137PNG\r\n\26\n" then return "png" end
    if bytes:sub(1, 3) == "\255\216\255" then return "jpg" end
    if bytes:sub(1, 4) == "RIFF" and bytes:sub(9, 12) == "WEBP" then return "webp" end
    if bytes:sub(1, 3) == "GIF" then return "gif" end
    return nil
end

-- Le module http de Millennium coupe le corps de la réponse au premier octet nul : inutilisable
-- pour une image. Téléchargement binaire commun : binary.lua.

---@ffi
---Télécharge une image SteamGridDB et la renvoie en base64 avec son format (png ou jpg).
---@param url string
---@return string
function sgdb_download(url)
    if not allowed_url(url) then return fail("Adresse d'image refusée.") end
    local ok, bytes, err = pcall(binary.download, url, "sgdb")
    if not ok then bytes, err = nil, tostring(bytes) end
    if not bytes then
        return fail("Téléchargement de l'image impossible (" .. tostring(err) .. ").")
    end
    if #bytes == 0 then return fail("Image vide.") end
    local format = detect_format(bytes)
    if format ~= "png" and format ~= "jpg" then
        return fail("Format d'image non pris en charge par Steam (" .. tostring(format or "inconnu") .. ").")
    end
    logger:info("SteamGridDB : image téléchargée (" .. format .. ", " .. #bytes .. " octets)")
    return result({ ok = true, format = format, size = #bytes, base64 = base64_encode(bytes) })
end

---@ffi
---Vérifie une clé (fenêtre d'accueil SteamGridDB) : { ok = true } si SteamGridDB l'accepte,
---sinon { ok = false, status = 401 } pour une clé refusée, ou un autre statut si le site ne répond pas.
---@param key string
---@return string
function sgdb_check(key)
    key = trim(tostring(key or ""))
    local body, err, status = api_get(key, "/search/autocomplete/portal")
    if not body then return fail(err, status) end
    return result({ ok = true })
end
