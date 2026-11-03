# Steam Upgraded

**A new interface for the Steam client, in desktop mode and in Big Picture.** Powered by [Millennium](https://steambrew.app/).

*[Version française](README.md)*

Steam Upgraded is a Millennium plugin that replaces Steam's interface with a fully redesigned one: library, game pages, store, settings, downloads, friends, Big Picture… Your games, your account and your Steam settings stay the same: only the display changes, and everything goes back to normal when you uninstall it.

**The interface is in French only for now.**

> Independent project, not affiliated with Valve. Steam is a trademark of Valve Corporation.

![Library](media/bureau-bibliotheque.jpg)

| Game page | Store | Settings › Appearance |
| --- | --- | --- |
| ![Game page](media/bureau-fiche.jpg) | ![Store](media/bureau-magasin.jpg) | ![Settings › Appearance](media/bureau-apparence.jpg) |

**In Big Picture**

| Home | Library |
| --- | --- |
| ![Big Picture: home](media/bp-accueil.jpg) | ![Big Picture: library](media/bp-bibliotheque.jpg) |
| **Game page** | **Store** |
| ![Big Picture: game page](media/bp-fiche.jpg) | ![Big Picture: store](media/bp-magasin.jpg) |

## What it brings

**Desktop mode**

- **A single top bar**: navigation, downloads, news, friends and account, instead of Steam's stacked bars and menus.
- **Library**: ready-made views (in progress, never played, installed, lent by family, multiple copies…), your collections, your Steam Family members, a "Resume" row and a grid of covers that grow on hover.
- **Game page**: banner and logo, playtime, achievements, copies available in your family (and which one to use), collections, friends who own the game.
- **Store**: the deals that matter to you, starting with your wishlist, at your country's prices.
- **One settings page**: Steam Upgraded's settings and Steam's own, side by side.
- **Steam pages and windows restyled**: downloads, menus, dialogs, properties, notifications, friends and chat, screenshots, soundtracks and music player.
- **Page transitions** and an animated opening, short, and following Windows' "reduce animations" setting.

**Big Picture**

- Home, library, game pages, store and product page, achievements, downloads, search, media, soundtracks, friends and chat: screens designed for a controller, showing the buttons of your own controller (Xbox, PlayStation…).
- Steam's remaining native menus and screens (settings, properties, Steam menu, quick access, virtual keyboard) are restyled in the same colors.

**Customization**

- Two dark themes: **Dark** and **OLED** (pure black).
- Eight accent colors and six background tints, all chosen to stay readable.
- Squircle corners, accent glow, HDR support.
- **SteamGridDB artwork**: pick the cover, banner, logo, wide capsule and icon of each game, with your own (free) SteamGridDB key.

## A few deliberate choices

- **Nothing is ever drawn over a cover**: no badges or text; information goes below, or in the card shown on hover.
- **Dark themes only.**
- **Valve's web pages** (Community, profiles, full store) stay as they are: restyling them would break with every Valve update.
- **No made-up numbers**: when data doesn't exist (price history, for example), it isn't shown.

## Installation

You need Windows and Steam. The installer handles the rest, Millennium included.

1. Download **`Installer Steam Upgraded <version>.exe`** from the [latest release](../../releases/latest).
2. Run it. The installer isn't signed: Windows SmartScreen may show "Windows protected your PC". Click "More info", then "Run anyway".
3. Follow the screens. The installer checks Steam and Millennium, installs or updates Millennium if needed (version 3.6 or later, downloaded from its official releases and verified), installs the plugin, then restarts Steam. Steam must be closed during installation: the installer asks you if it's open.

If anything fails, every change is rolled back.

**Manual installation** (if Millennium is already installed): copy `com.venacity.steamupgraded.star` (provided with each release) into Steam's `millennium\plugins` folder, then enable "Steam Upgraded" in Millennium's settings.

## SteamGridDB (optional)

To pick other artwork for your games, you need a SteamGridDB API key, personal and free:

1. Create an account on [steamgriddb.com](https://www.steamgriddb.com/).
2. In your profile, open **Preferences › API** and generate a key.
3. Paste it in the installer, or later in Steam Upgraded's **Paramètres › SteamGridDB**.

The key stays on your PC, in Millennium's configuration. Everyone uses their own: the plugin contains none.

## Updates

To move to a new version, download the new installer and run it: it offers to update to the new version. Your settings, SteamGridDB key and custom artwork are kept.

The installed version is shown in **Paramètres › Mises à jour**. Updating directly from these settings is coming in a future version.

## Uninstalling

- From Steam: **Paramètres › Mises à jour › Désinstaller…** (you can keep your settings for a later reinstall). Millennium stays installed.
- Or from the installer: it offers "Désinstaller", with the option to also remove Millennium if the installer put it there.

Either way, Steam gets its original interface back.

## Privacy

Steam Upgraded collects nothing and sends nothing to its author. It has no server. It only contacts:

- **Steam** (store, prices, wishlist, game images), like the Steam client itself;
- **SteamGridDB**, only if you entered a key and search for artwork;
- **Google Fonts**, to load the interface's Manrope font;
- **GitHub**, from the installer only, to download Millennium.

Your settings and playtime records (used for the chart on a game's page) stay on your PC.

## Development

Requirements: [Millennium](https://github.com/SteamClientHomebrew/Millennium) 3.6 or later, [Bun](https://bun.sh/) or Node.js, and Rust for the installer.

```bash
bun install        # dependencies (and Millennium types)
bun run build      # builds the plugin and installs it into the local Steam
```

Start Steam with `-dev` to get the interface's developer tools at `http://127.0.0.1:8080`. Reload the interface after a build.

The Windows installer (Tauri 2) is built with `bash installer/build.sh` into `installer/dist/`. The `--simulation [vierge|ancien|installe|sans-steam|erreur-reseau|steam-bloque]` mode works in a fake Steam folder, without touching the real one.

Code layout:

| Folder | Contents |
| --- | --- |
| `frontend/core/` | settings, theme (`--sp-*` colors), Steam data access, history and redirects, transitions |
| `frontend/shell/` | top bar, downloads, friends, music player |
| `frontend/pages/` | desktop pages |
| `frontend/bigpicture/` | Big Picture screens and restyling |
| `frontend/features/` | SteamGridDB, embedded Steam settings, music, uninstall… |
| `backend/` | Lua backend (store, SteamGridDB, artwork, uninstall) |
| `installer/` | Windows installer (Rust + HTML) |

## License

[MIT](LICENSE) © 2026 Venacity
