# Millennium pour macOS

[Millennium](https://github.com/SteamClientHomebrew/Millennium) ne publie pas de version pour Mac. Ce dossier permet de compiler celle qu'utilise Steam Upgraded sur macOS (Apple Silicon), à partir des sources officielles.

- `patches/` : correctifs appliqués au-dessus de l'étiquette officielle indiquée dans `../millennium.lock.json` (aujourd'hui `v3.6.2`). Ils viennent du support macOS de Millennium proposé par iFleey ([PR #841](https://github.com/SteamClientHomebrew/Millennium/pull/841)), fusionné avec cette version.
- `build-macos.sh` : clone Millennium à l'étiquette, applique les correctifs, compile et produit `dist/millennium-<étiquette>-macos-arm64.tar.gz` et son empreinte SHA-256. L'archive est jointe aux publications de Steam Upgraded ; elle n'est jamais ajoutée au dépôt.

```bash
brew install cmake ninja openssl@3 oven-sh/bun/bun
bash millennium/build-macos.sh
```

Il faut aussi les outils de ligne de commande de Xcode et Rust.

La compilation n'est ni signée ni notarisée par Apple : macOS demande une autorisation au premier lancement.

## Licence

Millennium : Copyright (c) 2026 Project Millennium, licence MIT ([texte complet](LICENSE-Millennium.md)). Les correctifs de `patches/` sont distribués sous la même licence. Chaque archive produite contient `LICENSE.md` (licence de Millennium) et `NOTICE.md` (origine de la compilation).
