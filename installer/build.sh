#!/usr/bin/env bash
# Compile l'installeur à envoyer : plugin (.star, en release) puis exécutable Tauri, copié dans installer/dist/
# (Windows : .exe ; macOS : app zippée Steam-Upgraded-macOS.zip).
# Usage : bash installer/build.sh
# Simulation (rien ne touche le vrai Steam) : "installer/dist/Installer Steam Upgraded <version>.exe" --simulation [vierge|ancien|installe|sans-steam|erreur-reseau|steam-bloque]
set -e
cd "$(dirname "$0")/.."

V_PLUGIN=$(grep -m1 '^version' millennium.toml | cut -d'"' -f2)
V_CARGO=$(grep -m1 '^version' installer/src-tauri/Cargo.toml | cut -d'"' -f2)
V_TAURI=$(node -e "process.stdout.write(require('./installer/src-tauri/tauri.conf.json').version)")
if [ "$V_PLUGIN" != "$V_CARGO" ] || [ "$V_CARGO" != "$V_TAURI" ]; then
  echo "Versions différentes : millennium.toml $V_PLUGIN, Cargo.toml $V_CARGO, tauri.conf.json $V_TAURI"
  exit 1
fi

# Verrou : pas deux compilations du plugin en même temps.
LOCK=.reload.lock
for i in $(seq 1 150); do mkdir "$LOCK" 2>/dev/null && break; sleep 2; done
BACKEND_COPY=$(mktemp -d)
trap 'cp -rf "$BACKEND_COPY/backend/." backend/ 2>/dev/null; rm -rf "$BACKEND_COPY"; rmdir "$LOCK" 2>/dev/null' EXIT

node node_modules/typescript/bin/tsc --noEmit -p .
mkdir -p installer/payload installer/dist
# `starlight pack --release` abîme l'UTF-8 des chaînes Lua (« refusée » arrivait « refusÃÂ©e » dans Steam) :
# leurs accents sont écrits en octets échappés le temps de la compilation, puis les fichiers d'origine sont remis.
cp -r backend "$BACKEND_COPY/"
find backend -name '*.lua' -print0 | xargs -0 node installer/tools/lua-ascii.mjs
# Attention : même avec -o, starlight redémarre le backend du plugin dans le Steam ouvert (HMR).
node node_modules/@steambrew/starlight/bin/starlight.js pack --release -o installer/payload 2>&1 | tail -1
cp -rf "$BACKEND_COPY/backend/." backend/
(cd installer/src-tauri && cargo build --release)

if [ "$(uname)" = "Darwin" ]; then
  # macOS : app « Installer Steam Upgraded », zippée. Non signée ni notarisée (choix assumé) : signature ad hoc seulement,
  # obligatoire sur Apple Silicon. Le zip garde son nom fixe pour les liens « dernière version » des README et de la landing.
  APP="installer/dist/Installer Steam Upgraded.app"
  rm -rf "$APP"
  mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
  cp installer/src-tauri/target/release/steam-upgraded-installeur "$APP/Contents/MacOS/"
  cp installer/src-tauri/icons/icon.icns "$APP/Contents/Resources/AppIcon.icns"
  cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key><string>fr</string>
    <key>CFBundleExecutable</key><string>steam-upgraded-installeur</string>
    <key>CFBundleIconFile</key><string>AppIcon</string>
    <key>CFBundleIdentifier</key><string>com.venacity.steamupgraded.installeur</string>
    <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
    <key>CFBundleName</key><string>Installer Steam Upgraded</string>
    <key>CFBundleDisplayName</key><string>Installer Steam Upgraded</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleShortVersionString</key><string>$V_PLUGIN</string>
    <key>CFBundleVersion</key><string>$V_PLUGIN</string>
    <key>LSMinimumSystemVersion</key><string>11.0</string>
    <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST
  codesign --force --deep -s - "$APP"
  ZIP="installer/dist/Steam-Upgraded-macOS.zip"
  rm -f "$ZIP"
  ditto -c -k --keepParent "$APP" "$ZIP"
  echo "→ $ZIP"
else
  OUT="installer/dist/Installer Steam Upgraded $V_PLUGIN.exe"
  cp installer/src-tauri/target/release/steam-upgraded-installeur.exe "$OUT"
  echo "→ $OUT"
fi
