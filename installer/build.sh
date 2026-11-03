#!/usr/bin/env bash
# Compile l'installeur à envoyer : plugin (.star, en release) puis exécutable Tauri, copié dans installer/dist/.
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
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

node node_modules/typescript/bin/tsc --noEmit -p .
mkdir -p installer/payload installer/dist
# Attention : même avec -o, starlight redémarre le backend du plugin dans le Steam ouvert (HMR).
node node_modules/@steambrew/starlight/bin/starlight.js pack --release -o installer/payload 2>&1 | tail -1
(cd installer/src-tauri && cargo build --release)
OUT="installer/dist/Installer Steam Upgraded $V_PLUGIN.exe"
cp installer/src-tauri/target/release/steam-upgraded-installeur.exe "$OUT"
echo "→ $OUT"
