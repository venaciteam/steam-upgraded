#!/usr/bin/env bash
# Compile Millennium pour macOS (arm64) et l'empaquette pour Steam Upgraded.
# Source : l'étiquette officielle de millennium.lock.json, plus les correctifs de millennium/patches/.
# Usage : bash millennium/build-macos.sh
# Sortie : millennium/dist/millennium-<tag>-macos-arm64.tar.gz (+ .sha256), et l'entrée « macos » de millennium.lock.json à
#          compléter avec l'adresse du fichier joint à la publication.
# Prérequis : outils de ligne de commande de Xcode, Rust, Homebrew : cmake ninja openssl@3 oven-sh/bun/bun.
# Rien n'est signé ni notarisé (choix assumé) : macOS demande une autorisation au premier lancement.
set -euo pipefail
cd "$(dirname "$0")"
HERE="$PWD"
export PATH="/opt/homebrew/bin:$HOME/.cargo/bin:$PATH"

[ "$(uname)" = "Darwin" ] || { echo "À lancer sur un Mac."; exit 1; }
[ "$(uname -m)" = "arm64" ] || { echo "Mac Apple Silicon (arm64) uniquement pour l'instant."; exit 1; }
for t in git cmake ninja bun cargo brew node; do command -v "$t" >/dev/null || { echo "Outil manquant : $t"; exit 1; }; done

TAG=$(node -e "process.stdout.write(require('../millennium.lock.json').tag)")
NAME="millennium-$TAG-macos-arm64"
WORK="$HERE/build/Millennium-$TAG"
OUT="$HERE/dist"

echo "→ Millennium $TAG, sources officielles"
rm -rf "$WORK"
git -c advice.detachedHead=false clone --quiet --depth 1 --branch "$TAG" https://github.com/SteamClientHomebrew/Millennium.git "$WORK"

echo "→ Correctifs macOS"
for p in "$HERE"/patches/*.patch; do
  (cd "$WORK" && git apply --whitespace=nowarn "$p")
  echo "   $(basename "$p")"
done

echo "→ Compilation (plusieurs minutes)"
(
  cd "$WORK"
  cmake --preset=osx-release -DOPENSSL_ROOT_DIR="$(brew --prefix openssl@3)" -DMILLENNIUM_RUN_TESTS_ON_BUILD=OFF >"$HERE/build/configure.log" 2>&1 \
    || { tail -20 "$HERE/build/configure.log"; exit 1; }
  cmake --build build/osx-release -- -j"$(sysctl -n hw.ncpu)" >"$HERE/build/build.log" 2>&1 \
    || { grep -E "error|FAILED" "$HERE/build/build.log" | head -20; exit 1; }
)

echo "→ Archive"
B="$WORK/build/osx-release"
T="$WORK/src/typescript"
PKG="$HERE/build/$NAME"
rm -rf "$PKG"
mkdir -p "$PKG/runtime/millennium-assets/loader/chunks" "$PKG/app"
# Même disposition que scripts/macos/install_macos.sh : runtime/ va dans ~/Library/Application Support/Millennium/runtime/<version>,
# app/ sert de modèle à l'app lanceur (Info.plist, icône), dont l'exécutable pointe vers runtime/steam_osx.
for f in steam_osx libmillennium.dylib libmillennium_bootstrap.dylib libmillennium_hhx64.dylib libmillennium_child_hook.dylib libmillennium_luavm_x86; do
  install -m 0755 "$B/$f" "$PKG/runtime/$f"
done
install -m 0644 "$T/sdk/build/millennium.js" "$PKG/runtime/millennium-assets/loader/millennium.js"
install -m 0644 "$T/sdk/build/chunks/"chunk-*.js "$PKG/runtime/millennium-assets/loader/chunks/"
install -m 0644 "$T/.frontend.bin" "$PKG/runtime/millennium-assets/millennium-frontend.js"
install -m 0644 "$WORK/src/bootstrap/macos/Info.plist.xml" "$PKG/app/Info.plist"
install -m 0644 "$WORK/src/bootstrap/macos/AppIcon.icns" "$PKG/app/AppIcon.icns"
# Licence de Millennium (MIT) : la mention de copyright accompagne obligatoirement chaque copie
install -m 0644 "$WORK/LICENSE.md" "$PKG/LICENSE.md"
cat >"$PKG/NOTICE.md" <<EOF
# Millennium $TAG pour macOS (arm64)

Millennium : https://github.com/SteamClientHomebrew/Millennium
Copyright (c) 2026 Project Millennium. Licence MIT : voir LICENSE.md.

Cette compilation n'est pas une publication officielle de Millennium. Elle est faite pour Steam Upgraded
(https://github.com/venaciteam/steam-upgraded) à partir de l'étiquette officielle $TAG et des correctifs du dossier
millennium/patches/ de ce dépôt, issus du support macOS de Millennium (PR #841 par iFleey :
https://github.com/SteamClientHomebrew/Millennium/pull/841).

Non signée et non notarisée par Apple.
EOF

mkdir -p "$OUT"
( cd "$HERE/build" && COPYFILE_DISABLE=1 tar --no-xattrs -czf "$OUT/$NAME.tar.gz" "$NAME" )
SHA=$(shasum -a 256 "$OUT/$NAME.tar.gz" | cut -d' ' -f1)
SIZE=$(stat -f %z "$OUT/$NAME.tar.gz")
echo "$SHA  $NAME.tar.gz" >"$OUT/$NAME.sha256"

echo
echo "✓ $OUT/$NAME.tar.gz ($SIZE octets)"
echo "  SHA-256 : $SHA"
echo
echo "Entrée « macos » de millennium.lock.json, une fois le fichier joint à la publication <vX.Y.Z> de Steam Upgraded :"
echo "  \"macos\": { \"url\": \"https://github.com/venaciteam/steam-upgraded/releases/download/<vX.Y.Z>/$NAME.tar.gz\", \"size\": $SIZE, \"sha256\": \"$SHA\" }"
