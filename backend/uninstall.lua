-- Désinstallation depuis nos Paramètres : suppression du fichier du plugin.
-- Le frontend fait le reste (réglages, désactivation dans Millennium, rechargement de l'interface).

local fs    = require("fs")
local cjson = require("json")

local STAR = "com.venacity.steamupgraded.star"

---@ffi
---Supprime le fichier .star du plugin. Le chemin vient de Millennium (Core_FindAllPlugins) ;
---seul notre fichier, dans un dossier de Millennium, est accepté.
---@param path string
---@return string
function sp_remove_plugin_file(path)
    path = tostring(path or "")
    local norm = path:gsub("\\", "/"):lower()
    if norm:sub(-#STAR - 1) ~= "/" .. STAR or not norm:find("/millennium/", 1, true) then
        return cjson.encode({ ok = false, error = "Chemin du plugin inattendu." })
    end
    local ok, err = fs.remove(path)
    if ok == nil then
        return cjson.encode({ ok = false, error = "Suppression impossible : " .. tostring(err) })
    end
    return cjson.encode({ ok = true })
end
