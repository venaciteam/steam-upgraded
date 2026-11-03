-- Visuels personnalisés : Steam les range dans userdata/<compte>/config/grid/<appid><suffixe>.png|.jpg.
-- Quand on remplace un visuel par un autre d'un format différent, Steam laisse l'ancien fichier en place :
-- il faut donc choisir le plus récent des deux, ce que seul le backend peut savoir (dates des fichiers).

local fs         = require("fs")
local millennium = require("millennium")

---@ffi
---Format du visuel personnalisé le plus récent pour un fichier de base (ex. « 553850p », « 553850_hero ») :
---« png », « jpg », ou « » s'il n'y en a aucun.
---@param account integer identifiant de compte Steam (32 bits)
---@param base string appid suivi du suffixe de l'emplacement
---@return string
function art_latest(account, base)
    account = tonumber(account)
    base = tostring(base or "")
    -- uniquement des chiffres et le suffixe : rien qui puisse sortir du dossier
    if not account or not base:match("^%d+[%w_]*$") then return "" end
    local dir = millennium.steam_path() .. "/userdata/" .. string.format("%d", account) .. "/config/grid/"
    local best, best_time = "", -1
    for _, ext in ipairs({ "png", "jpg" }) do
        local path = dir .. base .. "." .. ext
        if fs.exists(path) then
            local t = fs.last_write_time(path) or 0
            if t > best_time then
                best, best_time = ext, t
            end
        end
    end
    return best
end
