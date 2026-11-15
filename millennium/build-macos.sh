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

echo "→ Chemins de la machine retirés des fichiers compilés"
# Les compilateurs écrivent les chemins des sources dans les binaires (__FILE__, messages d'erreur des crates Rust) : le
# dossier personnel devient /home et le dossier de compilation /build (le dernier préfixe qui correspond l'emporte).
H=$(cd "$HOME" && pwd -P)
R=$(cd "$WORK" && pwd -P)
case "$H$R" in *[[:space:]]*) echo "Chemin avec une espace ($H, $R) : impossible à passer aux compilateurs."; exit 1 ;; esac
if echo 'int x;' | "${CC:-cc}" -ffile-prefix-map=/a=/b -x c -c - -o /dev/null 2>/dev/null; then
  MAP="-ffile-prefix-map=$H=/home -ffile-prefix-map=$R=/build"
else
  MAP="-fdebug-prefix-map=$H=/home -fdebug-prefix-map=$R=/build -fmacro-prefix-map=$H=/home -fmacro-prefix-map=$R=/build"
fi
# Lus par cmake à la première configuration (le dossier de compilation est neuf), dépendances de _deps comprises
for v in CFLAGS CXXFLAGS OBJCFLAGS OBJCXXFLAGS; do export "$v=${!v:+${!v} }$MAP"; done
# Éditeur de liens : chemins des .o et des archives écrits dans la table des symboles (entrées OSO de débogage, que
# -ffile-prefix-map ne touche pas) rendus relatifs au dossier de compilation
export LDFLAGS="${LDFLAGS:+$LDFLAGS }-Wl,-oso_prefix,$R/"
# Rust (corrosion) : à la suite des options déjà présentes ; cargo ignore RUSTFLAGS quand CARGO_ENCODED_RUSTFLAGS existe
if [ -n "${CARGO_ENCODED_RUSTFLAGS:-}" ]; then
  export CARGO_ENCODED_RUSTFLAGS="$CARGO_ENCODED_RUSTFLAGS"$'\x1f'"--remap-path-prefix=$H=/home"$'\x1f'"--remap-path-prefix=$R=/build"
else
  export RUSTFLAGS="${RUSTFLAGS:+$RUSTFLAGS }--remap-path-prefix=$H=/home --remap-path-prefix=$R=/build"
fi
# Le chargeur (src/typescript/sdk/rollup.config.js) écrit l'adresse absolue de sa carte des sources
# (file:///<dossier de compilation>/…/millennium.js.map), copiée dans les fichiers livrés et dans libmillennium.dylib :
# adresse relative à la place (la carte n'est pas livrée).
node -e '
const fs = require("fs"), f = process.argv[1], s = fs.readFileSync(f, "utf8");
const avant = "sourceMappingURL=file:///${absMapPath}", apres = "sourceMappingURL=${path.basename(absMapPath)}";
if (!s.includes(avant)) { console.error("   adresse de la carte des sources introuvable dans " + f); process.exit(1); }
fs.writeFileSync(f, s.replace(avant, apres));
' "$WORK/src/typescript/sdk/rollup.config.js"
# steam_osx garde en dur la racine des sources (MILLENNIUM_ROOT, repli « dev » qui lit les fichiers du chargeur dans
# les sources quand ils manquent à côté du binaire) : racine fictive /build à la place, absente des Mac des utilisateurs.
echo "   $H -> /home, $R -> /build, objets liés, racine des sources de steam_osx, carte des sources du chargeur"

echo "→ Compilation (plusieurs minutes)"
(
  cd "$WORK"
  cmake --preset=osx-release -DOPENSSL_ROOT_DIR="$(brew --prefix openssl@3)" -DMILLENNIUM_RUN_TESTS_ON_BUILD=OFF \
    -DMILLENNIUM_REPO_ROOT=/build >"$HERE/build/configure.log" 2>&1 \
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
# Propriétaire neutre (root:wheel) : sans cela, chaque en-tête tar porte le nom du compte qui a fabriqué l'archive
# (uname/gname). Options de bsdtar depuis libarchive 3.0.
( cd "$HERE/build" && COPYFILE_DISABLE=1 tar --no-xattrs --uid 0 --gid 0 --uname root --gname wheel -czf "$OUT/$NAME.tar.gz" "$NAME" )
# Contrôle anti-fuite des fichiers de l'archive, quand l'outil est présent (il n'est pas publié)
if [ -f "$HERE/../tools/verifier-fuite.mjs" ]; then
  echo "→ Contrôle anti-fuite"
  node "$HERE/../tools/verifier-fuite.mjs" "$OUT/$NAME.tar.gz" || {
    rm -f "$OUT/$NAME.tar.gz" "$OUT/$NAME.sha256"
    echo "Archive retirée : données personnelles ou chemins locaux (ci-dessus). Le contenu reste dans $PKG pour examen."
    exit 1
  }
fi
SHA=$(shasum -a 256 "$OUT/$NAME.tar.gz" | cut -d' ' -f1)
SIZE=$(stat -f %z "$OUT/$NAME.tar.gz")
echo "$SHA  $NAME.tar.gz" >"$OUT/$NAME.sha256"

echo
echo "✓ $OUT/$NAME.tar.gz ($SIZE octets)"
echo "  SHA-256 : $SHA"
echo
echo "Entrée « macos » de millennium.lock.json, une fois le fichier joint à la publication <vX.Y.Z> de Steam Upgraded :"
echo "  \"macos\": { \"url\": \"https://github.com/venaciteam/steam-upgraded/releases/download/<vX.Y.Z>/$NAME.tar.gz\", \"size\": $SIZE, \"sha256\": \"$SHA\" }"
