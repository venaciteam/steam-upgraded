// Réécrit les caractères non ASCII des chaînes Lua ("…" et '…') en octets échappés (« é » → \195\169).
// Pourquoi : `starlight pack --release` abîme l'UTF-8 des fichiers Lua (« refusée » arrive « refusÃÂ©e » dans Steam),
// alors que la compilation de développement les garde intacts. Des échappements ASCII passent sans dommage.
// Appelé par installer/build.sh sur les fichiers du backend, juste avant la compilation release, puis les
// originaux sont remis : le code source reste en français lisible.
// Usage : node installer/tools/lua-ascii.mjs <fichier.lua>…
import { readFileSync, writeFileSync } from 'node:fs';

const isEq = (b) => b === 0x3d; // '='

/** Longueur du délimiteur long ([[, [=[, [==[…) qui commence en i, ou -1. */
function longOpen(buf, i) {
	if (buf[i] !== 0x5b) return -1; // '['
	let j = i + 1;
	while (isEq(buf[j])) j++;
	return buf[j] === 0x5b ? j - i - 1 : -1;
}

/** Position juste après la fermeture ]=…=] de niveau `level`, à partir de i. */
function longClose(buf, i, level) {
	for (let k = i; k < buf.length; k++) {
		if (buf[k] !== 0x5d) continue; // ']'
		let j = k + 1, n = 0;
		while (isEq(buf[j])) { j++; n++; }
		if (n === level && buf[j] === 0x5d) return j + 1;
	}
	return buf.length;
}

function convert(buf, file) {
	const out = [];
	let changed = 0;
	let i = 0;
	while (i < buf.length) {
		const b = buf[i];
		// Commentaires : gardés tels quels (ils ne finissent pas dans les chaînes envoyées à Steam)
		if (b === 0x2d && buf[i + 1] === 0x2d) {
			const lvl = longOpen(buf, i + 2);
			let end;
			if (lvl >= 0) end = longClose(buf, i + 2 + lvl + 2, lvl);
			else {
				end = i;
				while (end < buf.length && buf[end] !== 0x0a) end++;
			}
			out.push(buf.subarray(i, end));
			i = end;
			continue;
		}
		// Chaîne longue [[…]] : pas d'échappement possible dedans
		const lvl = longOpen(buf, i);
		if (lvl >= 0) {
			const end = longClose(buf, i + lvl + 2, lvl);
			const s = buf.subarray(i, end);
			if (s.some((c) => c > 0x7f)) throw new Error(`${file} : caractère non ASCII dans une chaîne longue [[…]], à réécrire en "…".`);
			out.push(s);
			i = end;
			continue;
		}
		// Chaîne "…" ou '…'
		if (b === 0x22 || b === 0x27) {
			let j = i + 1;
			const parts = [Buffer.from([b])];
			while (j < buf.length && buf[j] !== b && buf[j] !== 0x0a) {
				if (buf[j] === 0x5c) { // '\' : l'échappement et le caractère suivant restent tels quels
					parts.push(buf.subarray(j, j + 2));
					j += 2;
					continue;
				}
				if (buf[j] > 0x7f) {
					parts.push(Buffer.from(`\\${buf[j]}`, 'ascii'));
					changed++;
				} else parts.push(buf.subarray(j, j + 1));
				j++;
			}
			if (buf[j] === b) { parts.push(Buffer.from([b])); j++; }
			out.push(...parts);
			i = j;
			continue;
		}
		out.push(buf.subarray(i, i + 1));
		i++;
	}
	return { data: Buffer.concat(out), changed };
}

let total = 0;
for (const file of process.argv.slice(2)) {
	const { data, changed } = convert(readFileSync(file), file);
	if (changed) writeFileSync(file, data);
	total += changed;
}
console.log(`Lua : ${total} octet(s) non ASCII échappé(s) dans les chaînes`);
