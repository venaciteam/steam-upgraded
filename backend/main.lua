local logger     = require("logger")
local millennium = require("millennium")

require("rpc_functions")
require("sgdb")
require("store")
require("art")
require("uninstall")
require("updates")
require("millennium_pin")

local function on_load()
    logger:info("Steam Upgraded chargé (Millennium " .. millennium.version() .. ")")
    millennium.ready()
end

local function on_unload()
    logger:info("Steam Upgraded déchargé")
end

return {
    on_load = on_load,
    on_unload = on_unload,
}
