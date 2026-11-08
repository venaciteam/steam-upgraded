-- Magasin : promos, liste de souhaits, évènements.
-- Le frontend (dans Steam) ne peut pas faire ces requêtes cross-origin : on les fait ici
-- et on renvoie du JSON en chaîne. Lecture seule : aucune action sur le compte.

local http   = require("http")
local cjson  = require("json") -- le module s'appelle « json » dans Millennium (implémentation cjson)
local logger = require("logger")

local UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
local CC, LANG, CURRENCY = "FR", "french", "EUR"

local function fetch(url)
    local ok, res, err = pcall(http.get, url, {
        timeout = 25,
        user_agent = UA,
        headers = { ["Accept-Language"] = "fr-FR,fr;q=0.9" },
    })
    if not ok then return nil, tostring(res) end
    if not res then return nil, err or "requête impossible" end
    if res.status ~= 200 then return nil, "HTTP " .. tostring(res.status) end
    return res.body
end

local function fetch_json(url)
    local body, err = fetch(url)
    if not body then return nil, err end
    local ok, data = pcall(cjson.decode, body)
    if not ok or type(data) ~= "table" then return nil, "réponse illisible" end
    return data
end

local function urlencode(s)
    return (tostring(s):gsub("[^%w%-%._~]", function(c) return string.format("%%%02X", string.byte(c)) end))
end

local function num(v)
    if v == nil or v == cjson.null then return nil end
    return tonumber(v)
end

local function str(v)
    if v == nil or v == cjson.null then return nil end
    return tostring(v)
end

local function decode_entities(s)
    if not s then return s end
    s = s:gsub("&#(%d+);", function(n)
        n = tonumber(n)
        if n and n < 128 then return string.char(n) end
        return "&#" .. n .. ";"
    end)
    s = s:gsub("&quot;", '"'):gsub("&#39;", "'"):gsub("&lt;", "<"):gsub("&gt;", ">"):gsub("&nbsp;", " "):gsub("&amp;", "&")
    return s
end

-- « 1 049,--€ » / « 19,99€ » -> centimes
local function price_to_cents(s)
    if not s then return nil end
    s = s:gsub(",%-%-", ",00")
    local digits = s:gsub("%D", "")
    if digits == "" then return nil end
    return tonumber(digits)
end

local function encode(t)
    local ok, out = pcall(cjson.encode, t)
    if ok then return out end
    return '{"ok":false,"error":"encodage impossible"}'
end

-- ---------- Noms des tags (une fois par session du backend) ----------

local tag_names = nil

local function get_tag_names()
    if tag_names then return tag_names end
    local data = fetch_json("https://store.steampowered.com/tagdata/populartags/" .. LANG)
    if type(data) ~= "table" then return {} end
    tag_names = {}
    for _, t in ipairs(data) do
        if t.tagid and t.name then tag_names[tonumber(t.tagid)] = t.name end
    end
    return tag_names
end

-- ---------- IStoreBrowseService/GetItems : données structurées ----------

local function normalize_item(it, names)
    local out = { appid = num(it.appid) or num(it.id), name = str(it.name) }
    local bpo = it.best_purchase_option
    if type(bpo) == "table" then
        out.final = num(bpo.final_price_in_cents)
        -- un lot affiche sa réduction de lot à part
        out.original = num(bpo.original_price_in_cents) or num(bpo.price_before_bundle_discount) or out.final
        out.discount = num(bpo.discount_pct) or num(bpo.bundle_discount_pct) or 0
        -- ce qu'on met au panier pour acheter le jeu (édition de base en général)
        out.packageid = num(bpo.packageid)
        out.bundleid = num(bpo.bundleid)
        out.games = num(bpo.included_game_count)
        out.lowestRecent = num(bpo.lowest_recent_price_in_cents)
        if type(bpo.active_discounts) == "table" then
            for _, d in ipairs(bpo.active_discounts) do
                local e = num(d.discount_end_date)
                if e and (not out.discountEnd or e < out.discountEnd) then out.discountEnd = e end
            end
        end
    end
    if it.is_free == true then out.free = true end
    local rel = it.release
    if type(rel) == "table" then
        out.release = num(rel.steam_release_date) or num(rel.original_release_date)
        if rel.is_coming_soon == true then
            out.comingSoon = true
            out.releaseText = str(rel.custom_release_date_message)
            -- date approximative (« 2027 », « T2 2027 ») : on n'affiche que l'année
            local disp = str(rel.coming_soon_display)
            if out.release and disp and disp ~= "date_full" then out.releaseYearOnly = true end
        end
    end
    -- Les images récentes ont un chemin haché : header.jpg « nu » renvoie 404, on suit les assets.
    local as = it.assets
    if type(as) == "table" and type(as.asset_url_format) == "string" and type(as.header) == "string" then
        local path = as.asset_url_format:gsub("%${FILENAME}", function() return as.header end)
        out.header = "https://shared.steamstatic.com/store_item_assets/" .. path
    end
    local rv =type(it.reviews) == "table" and it.reviews.summary_filtered
    if type(rv) == "table" and num(rv.review_count) and num(rv.review_count) > 0 then
        out.reviewPct = num(rv.percent_positive)
        out.reviewCount = num(rv.review_count)
        out.reviewScore = num(rv.review_score)
        out.reviewLabel = str(rv.review_score_label)
    end
    if type(it.tags) == "table" then
        local list = {}
        for _, t in ipairs(it.tags) do list[#list + 1] = t end
        table.sort(list, function(a, b) return (num(a.weight) or 0) > (num(b.weight) or 0) end)
        local tags = {}
        for _, t in ipairs(list) do
            local n = names[num(t.tagid) or -1]
            if n then tags[#tags + 1] = n end
            if #tags >= 3 then break end
        end
        if #tags > 0 then out.tags = tags end
    end
    return out
end

-- Renvoie appid -> élément normalisé (par lots de 100). `release` : dates de sortie en plus.
local function get_items(appids, release)
    local result, names, failed = {}, get_tag_names(), nil
    for i = 1, #appids, 100 do
        local ids = {}
        for j = i, math.min(i + 99, #appids) do ids[#ids + 1] = { appid = appids[j] } end
        local input = encode({
            ids = ids,
            context = { language = LANG, country_code = CC },
            data_request = { include_tag_count = 6, include_reviews = true, include_assets = true, include_release = release == true, include_basic_info = false },
        })
        local data, err = fetch_json("https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=" .. urlencode(input))
        local items = data and type(data.response) == "table" and data.response.store_items
        if type(items) == "table" then
            for _, it in ipairs(items) do
                if num(it.success) == 1 then
                    local n = normalize_item(it, names)
                    if n.appid then result[n.appid] = n end
                end
            end
        else
            failed = err or "GetItems indisponible"
            logger:warn("[store] GetItems : " .. tostring(failed))
        end
    end
    return result, failed
end

-- ---------- Promos du moment (recherche du magasin) ----------

local function parse_search_rows(html)
    local rows = {}
    for row in html:gmatch('<a href="[^"]*"%s+data%-ds%-.-</a>') do
        local appid = row:match('data%-ds%-appid="(%d+)"')
        if appid and not row:find('data%-ds%-packageid', 1) and not row:find('data%-ds%-bundleid', 1) then
            local r = { appid = tonumber(appid) }
            r.name = decode_entities(row:match('<span class="title">(.-)</span>'))
            r.capsule = row:match('<div class="search_capsule"><img src="([^"]+)"')
            r.discount = tonumber(row:match('data%-discount="(%d+)"') or "0")
            r.final = tonumber(row:match('data%-price%-final="(%d+)"') or "")
            r.original = price_to_cents(row:match('<div class="discount_original_price">(.-)</div>')) or r.final
            local tip = row:match('search_review_summary[^"]*"%s+data%-tooltip%-html="(.-)"')
            if tip then
                tip = decode_entities(tip)
                r.reviewLabel = tip:match("^(.-)<br>")
                r.reviewPct = tonumber(tip:match("<br>(%d+)"))
            end
            local tagids = row:match('data%-ds%-tagids="%[(.-)%]"')
            if tagids then
                local names, tags = get_tag_names(), {}
                for id in tagids:gmatch("%d+") do
                    local n = names[tonumber(id)]
                    if n then tags[#tags + 1] = n end
                    if #tags >= 3 then break end
                end
                if #tags > 0 then r.tags = tags end
            end
            rows[#rows + 1] = r
        end
    end
    return rows
end

---@ffi
---@param start number
---@param count number
---@return string
function sp_store_specials(start, count)
    start = math.max(0, math.floor(tonumber(start) or 0))
    count = math.min(100, math.max(1, math.floor(tonumber(count) or 100)))
    local url = string.format(
        "https://store.steampowered.com/search/results/?specials=1&infinite=1&cc=%s&l=%s&start=%d&count=%d",
        CC, LANG, start, count)
    local data, err = fetch_json(url)
    if not data or type(data.results_html) ~= "string" then
        return encode({ ok = false, error = err or "recherche indisponible" })
    end
    local rows = parse_search_rows(data.results_html)
    local ids = {}
    for _, r in ipairs(rows) do ids[#ids + 1] = r.appid end
    local extra = get_items(ids)
    for _, r in ipairs(rows) do
        local e = extra[r.appid]
        if e then
            r.name = e.name or r.name
            if e.reviewPct then
                r.reviewPct, r.reviewCount, r.reviewScore, r.reviewLabel = e.reviewPct, e.reviewCount, e.reviewScore, e.reviewLabel
            end
            r.tags = e.tags or r.tags
            r.header = e.header
            -- Prix structurés de GetItems quand ils portent la promo (le HTML omet parfois l'ancien prix)
            if e.final and (e.discount or 0) > 0 then
                r.final, r.original, r.discount = e.final, e.original or r.original, e.discount
            end
            r.discountEnd = e.discountEnd
            r.lowestRecent = e.lowestRecent
        end
    end
    return encode({
        ok = true,
        total = num(data.total_count) or 0,
        start = start,
        fetched = #rows,
        items = rows,
    })
end

-- ---------- Liste de souhaits ----------

-- Repli si GetItems échoue : prix seuls, via appdetails (plusieurs ids passent avec ce filtre).
local function prices_from_appdetails(appids)
    local out = {}
    for i = 1, #appids, 50 do
        local chunk = {}
        for j = i, math.min(i + 49, #appids) do chunk[#chunk + 1] = tostring(appids[j]) end
        local data = fetch_json("https://store.steampowered.com/api/appdetails?appids=" .. table.concat(chunk, ",") .. "&cc=" .. CC .. "&filters=price_overview")
        if type(data) == "table" then
            for id, v in pairs(data) do
                local po = type(v) == "table" and type(v.data) == "table" and v.data.price_overview
                if type(po) == "table" then
                    out[tonumber(id)] = {
                        appid = tonumber(id),
                        final = num(po.final),
                        original = num(po.initial),
                        discount = num(po.discount_percent) or 0,
                    }
                end
            end
        end
    end
    return out
end

---@ffi
---@param steamid string
---@return string
function sp_store_wishlist(steamid)
    steamid = tostring(steamid or "")
    if not steamid:match("^%d+$") then
        return encode({ ok = false, error = "identifiant Steam inconnu" })
    end
    local data, err = fetch_json("https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid=" .. steamid)
    if not data then return encode({ ok = false, error = err }) end
    local list = type(data.response) == "table" and data.response.items
    if type(list) ~= "table" or #list == 0 then
        -- Une liste privée et une liste vide renvoient la même réponse.
        return encode({ ok = true, empty = true, count = 0, items = {} })
    end
    local ids, meta = {}, {}
    for _, w in ipairs(list) do
        local id = num(w.appid)
        if id then
            ids[#ids + 1] = id
            meta[id] = { priority = num(w.priority), added = num(w.date_added) }
        end
    end
    local items, failed = get_items(ids, true)
    local source = "GetItems"
    if failed and next(items) == nil then
        items = prices_from_appdetails(ids)
        source = "appdetails"
    end
    local out = {}
    for _, id in ipairs(ids) do
        local it = items[id] or { appid = id }
        it.priority = meta[id].priority
        it.added = meta[id].added
        out[#out + 1] = it
    end
    return encode({ ok = true, empty = false, count = #ids, source = source, items = out })
end

-- ---------- Panier : noms, images et prix actuels des articles ----------

-- Le panier lui-même est lu par le client Steam (pages/store/cart.ts) ; il ne donne que des numéros
-- de paquets (packageid) ou de lots (bundleid). `json` : [{ "packageid": 1 }, { "bundleid": 2 }, …]
---@ffi
---@param json string
---@return string
function sp_store_cart_items(json)
    local ok, list = pcall(cjson.decode, tostring(json or ""))
    if not ok or type(list) ~= "table" then return encode({ ok = false, error = "liste illisible" }) end
    local ids = {}
    for _, v in ipairs(list) do
        if type(v) == "table" then
            local p, b = num(v.packageid), num(v.bundleid)
            if p and p > 0 then ids[#ids + 1] = { packageid = p }
            elseif b and b > 0 then ids[#ids + 1] = { bundleid = b } end
        end
        if #ids >= 100 then break end
    end
    if #ids == 0 then return encode({ ok = true, items = {} }) end
    local data, err = fetch_json("https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=" .. urlencode(encode({
        ids = ids,
        context = { language = LANG, country_code = CC },
        data_request = { include_assets = true },
    })))
    local items = data and type(data.response) == "table" and data.response.store_items
    if type(items) ~= "table" then return encode({ ok = false, error = err or "GetItems indisponible" }) end
    local out, noHeader = {}, {}
    for _, it in ipairs(items) do
        if num(it.success) == 1 then
            local n = normalize_item(it, {})
            local kind = num(it.item_type) == 2 and "b" or "p"
            n.key = kind .. ":" .. tostring(num(it.id))
            -- un paquet donne le jeu auquel il appartient ; un lot, ses jeux
            n.appid = num(it.appid)
            if not n.appid and type(it.included_appids) == "table" then n.appid = num(it.included_appids[1]) end
            if kind == "b" and type(it.included_appids) == "table" then n.games = #it.included_appids end
            n.packageid, n.bundleid = nil, nil
            if not n.header and n.appid then noHeader[#noHeader + 1] = n end
            out[#out + 1] = n
        end
    end
    -- Paquets sans image (éditions anciennes) : celle du jeu
    if #noHeader > 0 then
        local apps = {}
        for _, n in ipairs(noHeader) do apps[#apps + 1] = n.appid end
        local byApp = get_items(apps)
        for _, n in ipairs(noHeader) do
            local a = byApp[n.appid]
            if a then n.header = a.header end
        end
    end
    return encode({ ok = true, items = out })
end

-- ---------- Mises en avant (offre du jour, évènements) ----------

---@ffi
---@return string
function sp_store_featured()
    local data, err = fetch_json("https://store.steampowered.com/api/featuredcategories?cc=" .. CC .. "&l=" .. LANG)
    if not data then return encode({ ok = false, error = err }) end
    local spotlights, daily = {}, nil
    for k, v in pairs(data) do
        if type(v) == "table" and type(v.items) == "table" then
            if v.id == "cat_spotlight" then
                for _, it in ipairs(v.items) do
                    if it.name and it.url then
                        spotlights[#spotlights + 1] = {
                            key = tostring(k),
                            name = str(it.name),
                            url = str(it.url),
                            image = str(it.header_image) or str(it.image) or str(it.large_capsule_image),
                            body = str(it.body),
                        }
                    end
                end
            elseif v.id == "cat_dailydeal" and v.items[1] then
                local d = v.items[1]
                daily = {
                    appid = num(d.id),
                    name = str(d.name),
                    discount = num(d.discount_percent),
                    final = num(d.final_price),
                    original = num(d.original_price),
                    header = str(d.header_image),
                }
            end
        end
    end
    table.sort(spotlights, function(a, b) return a.key < b.key end)
    local specialsCount = type(data.specials) == "table" and type(data.specials.items) == "table" and #data.specials.items or 0
    return encode({ ok = true, spotlights = spotlights, daily = daily, specialsCount = specialsCount })
end

-- ---------- Page de vente d'un jeu (Big Picture) ----------

-- Descripteurs PEGI (fournis en anglais par Steam)
local PEGI_FR = {
    ["violence"] = "violence", ["bad language"] = "langage grossier", ["fear"] = "peur", ["horror"] = "horreur",
    ["drugs"] = "drogues", ["sex"] = "sexe", ["discrimination"] = "discrimination", ["gambling"] = "jeux de hasard",
    ["in-game purchases"] = "achats en jeu", ["online"] = "jeu en ligne",
}

-- Espace disque lu dans le texte de la configuration requise (« Espace disque : 9 GB d'espace disque disponible »,
-- « Storage: 500 MB available space »…), converti en Go.
local DISK_LABELS = { "espace disque", "stockage", "storage", "hard drive", "hard disk", "disque dur" }
local function disk_from_html(html)
    if type(html) ~= "string" or html == "" then return nil end
    local text = html:gsub("<[^>]*>", " "):lower()
    for _, label in ipairs(DISK_LABELS) do
        local at = text:find(label, 1, true)
        if at then
            local part = text:sub(at + #label, at + #label + 80)
            local n, unit = part:match("^[^%d]-(%d+[%.,]?%d*)[^%a]*(%a+)")
            n = n and tonumber((n:gsub(",", ".")))
            if n and unit then
                if unit == "gb" or unit == "go" or unit == "gib" then return n end
                if unit == "mb" or unit == "mo" or unit == "mib" then return n / 1024 end
                if unit == "tb" or unit == "to" then return n * 1024 end
            end
        end
    end
    return nil
end

local function disk_gb(req)
    if type(req) ~= "table" then return nil end
    return disk_from_html(req.recommended) or disk_from_html(req.minimum)
end

---@ffi
---@param appid number
---@return string
function sp_store_app(appid)
    appid = tonumber(appid)
    if not appid then return encode({ ok = false, error = "jeu inconnu" }) end
    local data, err = fetch_json("https://store.steampowered.com/api/appdetails?appids=" .. appid .. "&cc=" .. CC .. "&l=" .. LANG)
    local entry = data and data[tostring(appid)]
    if type(entry) ~= "table" or entry.success ~= true or type(entry.data) ~= "table" then
        return encode({ ok = false, error = err or "jeu absent du magasin" })
    end
    local d = entry.data
    local out = {
        ok = true, appid = appid, name = str(d.name), type = str(d.type),
        short = decode_entities(str(d.short_description)),
        free = d.is_free == true or nil,
        background = str(d.background_raw) or str(d.background),
        header = str(d.header_image),
        controller = str(d.controller_support),
        achievements = type(d.achievements) == "table" and num(d.achievements.total) or nil,
        metacritic = type(d.metacritic) == "table" and num(d.metacritic.score) or nil,
    }
    local po = d.price_overview
    if type(po) == "table" then
        out.final = num(po.final)
        out.original = num(po.initial)
        out.discount = num(po.discount_percent) or 0
    end
    if type(d.release_date) == "table" then
        out.release = str(d.release_date.date)
        out.comingSoon = d.release_date.coming_soon == true or nil
    end
    local function names(list, key)
        local t = {}
        if type(list) == "table" then for _, v in ipairs(list) do t[#t + 1] = str(type(v) == "table" and v[key] or v) end end
        return t
    end
    out.developers = names(d.developers)
    out.publishers = names(d.publishers)
    out.genres = names(d.genres, "description")
    out.categories = {}
    if type(d.categories) == "table" then for _, c in ipairs(d.categories) do out.categories[#out.categories + 1] = num(c.id) end end
    -- Français : présent = interface et textes ; suivi d'un astérisque = doublage aussi
    local langs = str(d.supported_languages) or ""
    if langs:find("Français<strong>*</strong>", 1, true) then out.french = "audio"
    elseif langs:find("Français", 1, true) then out.french = "texte"
    else out.french = "non" end
    out.screenshots = {}
    if type(d.screenshots) == "table" then
        for _, s in ipairs(d.screenshots) do out.screenshots[#out.screenshots + 1] = { thumb = str(s.path_thumbnail), full = str(s.path_full) } end
    end
    out.movies = {}
    if type(d.movies) == "table" then
        -- dash : manifeste de la vidéo (Steam ne la fournit qu'en DASH ou HLS), lu par bigpicture/dash.ts
        for _, m in ipairs(d.movies) do out.movies[#out.movies + 1] = { thumb = str(m.thumbnail), name = str(m.name), dash = str(m.dash_h264) } end
    end
    local pegi = type(d.ratings) == "table" and d.ratings.pegi
    if type(pegi) == "table" then
        out.pegi = str(pegi.rating)
        local desc = {}
        for line in (str(pegi.descriptors) or ""):gmatch("[^\r\n]+") do
            local k = line:lower():gsub("^%s+", ""):gsub("%s+$", "")
            if k ~= "" then desc[#desc + 1] = PEGI_FR[k] or k end
        end
        out.pegiDescriptors = desc
    end
    -- Espace disque de la configuration requise (recommandée, sinon minimale), en Go ; pas de chiffre si Steam n'en donne pas
    out.diskGb = disk_gb(d.pc_requirements)
    out.diskGbMac = disk_gb(d.mac_requirements)
    -- Avis, tags, fin de promo et grande bannière : GetItems
    local input = encode({
        ids = { { appid = appid } },
        context = { language = LANG, country_code = CC },
        data_request = { include_tag_count = 8, include_reviews = true, include_assets = true },
    })
    local gi = fetch_json("https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=" .. urlencode(input))
    local it = gi and type(gi.response) == "table" and type(gi.response.store_items) == "table" and gi.response.store_items[1]
    if type(it) == "table" and num(it.success) == 1 then
        local n = normalize_item(it, get_tag_names())
        out.reviewPct, out.reviewCount, out.reviewScore, out.reviewLabel = n.reviewPct, n.reviewCount, n.reviewScore, n.reviewLabel
        out.tags = n.tags
        out.discountEnd = n.discountEnd
        local as = it.assets
        if type(as) == "table" and type(as.asset_url_format) == "string" and type(as.library_hero) == "string" then
            local path = as.asset_url_format:gsub("%${FILENAME}", function() return as.library_hero end)
            out.hero = "https://shared.steamstatic.com/store_item_assets/" .. path
        end
    end
    return encode(out)
end

---@ffi
---@param term string
---@return string
function sp_store_search(term)
    term = tostring(term or ""):gsub("^%s+", ""):gsub("%s+$", "")
    if #term < 2 then return encode({ ok = true, items = {} }) end
    local data, err = fetch_json("https://store.steampowered.com/api/storesearch/?term=" .. urlencode(term) .. "&l=" .. LANG .. "&cc=" .. CC)
    if type(data) ~= "table" then return encode({ ok = false, error = err or "recherche impossible" }) end
    local items = {}
    if type(data.items) == "table" then
        for _, it in ipairs(data.items) do
            if type(it) == "table" and num(it.id) then
                local p = type(it.price) == "table" and it.price or nil
                items[#items + 1] = {
                    appid = num(it.id), name = str(it.name), image = str(it.tiny_image),
                    final = p and num(p.final) or nil, original = p and num(p.initial) or nil,
                }
            end
        end
    end
    return encode({ ok = true, items = items })
end

-- ---------- Actualites et mises a jour d'un jeu ----------

-- Evenements de la page communautaire du jeu (ceux que montre la bibliotheque de Steam), dans la langue du
-- client quand l'editeur a traduit. Types : 12 petite mise a jour, 13 mise a jour, 14 mise a jour majeure ;
-- les autres sont des actualites, evenements, promotions. Le texte reste en BBCode : le frontend le met en forme.
local UPDATE_TYPES = { [12] = true, [13] = true, [14] = true }
local NEWS_PAGE = 20

---@ffi
---@param appid number
---@param offset number
---@param updatesOnly boolean
---@return string
function sp_app_news(appid, offset, updatesOnly)
    appid = tonumber(appid)
    offset = math.max(0, math.floor(tonumber(offset) or 0))
    if not appid then return encode({ ok = false, error = "jeu inconnu" }) end
    local data, err = fetch_json("https://store.steampowered.com/events/ajaxgetpartnereventspageable/?clan_accountid=0&appid="
        .. appid .. "&offset=" .. offset .. "&count=" .. NEWS_PAGE .. "&l=" .. LANG)
    if type(data) ~= "table" then return encode({ ok = false, error = err or "actualites indisponibles" }) end
    local events = type(data.events) == "table" and data.events or {}
    local items = {}
    for _, e in ipairs(events) do
        local kind = num(e.event_type) or 0
        local b = type(e.announcement_body) == "table" and e.announcement_body or {}
        if (not updatesOnly or UPDATE_TYPES[kind]) and e.hidden ~= 1 and b.hidden ~= 1 then
            items[#items + 1] = {
                gid = str(e.gid),
                type = kind,
                title = str(b.headline) or str(e.event_name) or "",
                time = num(e.rtime32_start_time) or num(b.posttime) or 0,
                lang = num(b.language) or 0,
                body = str(b.body) or "",
                clan = str(e.clan_steamid),
                announcement = str(b.gid),
            }
        end
    end
    return encode({ ok = true, items = items, nextOffset = offset + #events, more = #events >= NEWS_PAGE })
end

-- ---------- Pays et devise du magasin ----------

-- Pays du magasin : celui de l'utilisateur (adresse IP vue par Steam), les prix varient d'un pays à l'autre.
-- Sa devise est lue sur un jeu payant partout (Portal 2) ; sans réponse, on garde la France et l'euro,
-- pour ne jamais afficher des prix d'un pays dans la devise d'un autre.
---@ffi
---@param cc string
---@return string
function sp_store_set_country(cc)
    cc = type(cc) == "string" and cc:upper() or ""
    if cc:match("^%u%u$") and cc ~= CC then
        local data = fetch_json("https://store.steampowered.com/api/appdetails?appids=620&cc=" .. cc .. "&filters=price_overview")
        local entry = type(data) == "table" and data["620"] or nil
        local po = type(entry) == "table" and type(entry.data) == "table" and entry.data.price_overview or nil
        if type(po) == "table" and type(po.currency) == "string" and po.currency:match("^%u%u%u$") then
            CC, CURRENCY = cc, po.currency
        end
    end
    return encode({ cc = CC, currency = CURRENCY })
end
