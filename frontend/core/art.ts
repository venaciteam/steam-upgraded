// Visuels personnalisés (SteamGridDB ou fichier local) : trouver le bon fichier et prévenir les pages quand il change.
// Steam expose deux adresses possibles par visuel (.jpg et .png). Un fichier absent renvoie un faux fichier
// de 40 octets ; et quand on remplace un visuel par un autre d'un format différent, Steam garde l'ancien
// fichier : le backend nous dit lequel est le plus récent (backend/art.lua).
import { useEffect, useState } from 'react';
import { myAccountId } from './steam';

const w = window as any;

export type ArtKind = 'capsule' | 'hero' | 'logo' | 'header' | 'icon';

const SUFFIX: Record<ArtKind, string> = { capsule: 'p', hero: '_hero', logo: '_logo', header: '', icon: '_icon' };

// Adresse absolue : une adresse relative ne mène nulle part depuis la fenêtre principale (about:blank)
const BASE = 'https://steamloopback.host/customimages/';

const found = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();
const listeners = new Set<() => void>();

/** Version des visuels personnalisés d'un jeu (0 = aucun). Change à chaque modification. */
export function artStamp(app: any): number {
	const fresh = w.appStore?.GetAppOverviewByAppID?.(app?.appid) || app;
	return Number(fresh?.rt_custom_image_mtime || 0);
}

/** Adresse du visuel personnalisé, ou null s'il n'y en a pas pour cet emplacement. */
export function customArt(appid: number, kind: ArtKind, stamp: number): Promise<string | null> {
	if (!stamp) return Promise.resolve(null);
	const key = `${appid}:${kind}:${stamp}`;
	if (found.has(key)) return Promise.resolve(found.get(key)!);
	let p = pending.get(key);
	if (!p) {
		p = (async () => {
			let latest = '';
			try {
				latest = String((await backend.art_latest(myAccountId(), `${appid}${SUFFIX[kind]}`)) || '');
			} catch {
				// backend indisponible : on sonde les deux formats
			}
			const order = latest === 'jpg' ? ['jpg', 'png'] : ['png', 'jpg'];
			for (const ext of order) {
				const url = `${BASE}${appid}${SUFFIX[kind]}.${ext}?v=${stamp}`;
				try {
					const res = await fetch(url, { cache: 'no-store' });
					if (res.ok && (await res.blob()).size > 100) return url;
				} catch {
					// fichier absent
				}
			}
			return null;
		})().then((url) => {
			found.set(key, url);
			pending.delete(key);
			return url;
		});
		pending.set(key, p);
	}
	return p;
}

/** Visuel à afficher : le personnalisé s'il existe, sinon `fallback`. */
export function useArt(app: any, kind: ArtKind, fallback: string): string {
	const stamp = artStamp(app);
	const appid = app?.appid;
	const key = `${appid}:${kind}:${stamp}`;
	const [url, set] = useState<string>(() => (stamp && found.get(key)) || fallback);
	useEffect(() => {
		let alive = true;
		set((stamp && found.get(key)) || fallback);
		if (stamp && appid) customArt(appid, kind, stamp).then((u) => alive && set(u || fallback));
		return () => {
			alive = false;
		};
	}, [key, fallback]);
	return url;
}

/** À appeler après une modification : les pages relisent leurs visuels. */
export function notifyArtChanged() {
	// Steam met à jour rt_custom_image_mtime juste après l'écriture du fichier
	setTimeout(() => listeners.forEach((fn) => fn()), 400);
	setTimeout(() => listeners.forEach((fn) => fn()), 1500);
}

export function onArtChanged(fn: () => void): () => void {
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
}
