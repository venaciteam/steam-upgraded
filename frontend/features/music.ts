// Bandes-son et lecteur de musique de Steam : pistes d'un album, état de lecture, commandes.
// La lecture passe par le lecteur de Steam (l'album doit être téléchargé) ; on n'en montre que les commandes.
import { useEffect, useState } from 'react';
import { findModuleExport } from 'millennium';
import { appById, mainWindow } from '../core/steam';

const w = window as any;

/** Type d'une bande-son dans Steam (EAppType). */
export const MUSIC_APP_TYPE = 8192;

export function isSoundtrack(appid: number): boolean {
	return appById(appid)?.app_type === MUSIC_APP_TYPE;
}

/** Pochettes carrées de l'album (copie locale de Steam d'abord). */
export function albumCovers(app: any): string[] {
	const store = w.appStore;
	return [store?.GetCachedAlbumCoverURL?.(app), store?.GetAlbumCoverURLForApp?.(app)].filter(Boolean) as string[];
}

const smallCovers = new Map<string, Promise<string>>();

/**
 * Pochette réduite à `px` de côté (adresse data:). Les originaux vont jusqu'à 3000 px : à plusieurs dans une grille,
 * ils dépassent le cache d'images de Chromium, qui renonce à en dessiner certains (pochette restée grise).
 */
function smallCover(src: string, px: number): Promise<string> {
	const key = `${src}@${px}`;
	let p = smallCovers.get(key);
	if (!p) {
		p = (async () => {
			// Adresse absolue : une adresse relative ne mène nulle part depuis une fenêtre about:blank.
			const res = await fetch(new URL(src, 'https://steamloopback.host/').href);
			if (!res.ok) throw new Error(String(res.status));
			const bmp = await createImageBitmap(await res.blob(), { resizeWidth: px, resizeHeight: px, resizeQuality: 'high' });
			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = px;
			canvas.getContext('2d')!.drawImage(bmp, 0, 0);
			bmp.close();
			return canvas.toDataURL('image/jpeg', 0.9);
		})();
		p.catch(() => smallCovers.delete(key));
		smallCovers.set(key, p);
	}
	return p;
}

/** Pochette de l'album réduite à `px` de côté ; `failed` si aucune source ne répond. */
export function useAlbumCover(app: any, px: number): { src?: string; failed: boolean } {
	const [state, setState] = useState<{ src?: string; failed: boolean }>({ failed: false });
	const appid = app?.appid;
	useEffect(() => {
		let alive = true;
		setState({ failed: false });
		(async () => {
			for (const src of albumCovers(app)) {
				try {
					const small = await smallCover(src, px);
					if (alive) setState({ src: small, failed: false });
					return;
				} catch {}
			}
			if (alive) setState({ failed: true });
		})();
		return () => {
			alive = false;
		};
	}, [appid, px]);
	return state;
}

export function isAlbumInstalled(app: any): boolean {
	return !!(app?.installed || app?.per_client_data?.some?.((c: any) => c?.installed));
}

export type Track = { index: number; disc: number; number: number; name: string; seconds: number };

export type Album = { tracks: Track[]; artist: string; seconds: number } | null;

const albumCache = new Map<number, Promise<Album>>();

function loadAlbum(appid: number): Promise<Album> {
	let p = albumCache.get(appid);
	if (!p) {
		p = (async () => {
			const d = await w.SteamClient?.Apps?.GetSoundtrackDetails?.(appid);
			if (!d?.tracks) return null;
			const tracks: Track[] = [...d.tracks]
				.sort((a: any, b: any) => a.discNumber - b.discNumber || a.trackNumber - b.trackNumber)
				.map((t: any, i: number) => ({ index: i, disc: Number(t.discNumber) || 1, number: Number(t.trackNumber) || i + 1, name: String(t.trackDisplayName || ''), seconds: Number(t.durationSeconds) || 0 }));
			return { tracks, artist: String(d.metadata?.artist || ''), seconds: tracks.reduce((n, t) => n + t.seconds, 0) };
		})();
		p.catch(() => albumCache.delete(appid));
		albumCache.set(appid, p);
	}
	return p;
}

/** Pistes d'un album (undefined pendant le chargement, null si Steam n'en donne pas). */
export function useAlbum(appid: number): Album | undefined {
	const [album, set] = useState<Album | undefined>(undefined);
	useEffect(() => {
		let alive = true;
		set(undefined);
		if (appid) loadAlbum(appid).then((a) => alive && set(a), () => alive && set(null));
		return () => {
			alive = false;
		};
	}, [appid]);
	return album;
}

// ---------- Lecture ----------

export const Status = { Playing: 1, Paused: 2, Idle: 3 } as const;

export const Repeat = { None: 0, All: 1, Once: 2 } as const;

export type Playback = { appid: number; track: number; status: number; repeat: number; shuffle: boolean; volume: number; lengthMs: number };

let store: any;

/** Magasin de lecture de Steam (celui de son propre lecteur). */
function musicStore(): any {
	if (store !== undefined) return store;
	try {
		store = findModuleExport((e: any) => e && typeof e === 'object' && typeof e.updatePlaybackState === 'function' && 'currentActiveTrack' in e) || null;
	} catch {
		store = null;
	}
	return store;
}

function readPlayback(): Playback | null {
	const s = musicStore()?.m_playbackState;
	if (!s || !s.uSoundtrackAppId) return null;
	return {
		appid: Number(s.uSoundtrackAppId),
		track: Number(s.nActiveTrack) || 0,
		status: Number(s.ePlaybackStatus) || 0,
		repeat: Number(s.eRepeatStatus) || 0,
		shuffle: !!s.bShuffle,
		volume: Number(s.nVolume) || 0,
		lengthMs: Number(s.nLengthInMsec) || 0,
	};
}

const same = (a: Playback | null, b: Playback | null) => JSON.stringify(a) === JSON.stringify(b);

/** État du lecteur de Steam (null si rien n'a été lancé). */
export function usePlayback(): Playback | null {
	const [pb, set] = useState<Playback | null>(readPlayback);
	useEffect(() => {
		const id = setInterval(() => {
			const next = readPlayback();
			set((cur) => (same(cur, next) ? cur : next));
		}, 500);
		return () => clearInterval(id);
	}, []);
	return pb;
}

/** Position dans la piste en cours, en millisecondes. */
export function usePosition(active: boolean): number {
	const [ms, set] = useState(0);
	useEffect(() => {
		if (!active) return undefined;
		const h = w.SteamClient?.Music?.RegisterForMusicPlaybackPosition?.((p: number) => set(Number(p) || 0));
		return () => h?.unregister?.();
	}, [active]);
	return ms;
}

const M = () => w.SteamClient.Music;

/** Lance l'album, à partir d'une piste (index dans la liste, à partir de 0) si elle est donnée. */
export function playAlbum(appid: number, index?: number) {
	const win = mainWindow();
	if (!win) return;
	win.location.href = `steam://musicplayer/playappalbum/${appid}${index !== undefined ? `/${index + 1}` : ''}`;
}

export const music = {
	toggle: () => M().TogglePlayPause(),
	next: () => M().PlayNext(),
	previous: () => M().PlayPrevious(),
	shuffle: (on: boolean) => M().SetPlayingShuffled(on),
	/** Aucune → tout l'album → la piste en boucle → aucune. */
	cycleRepeat: (cur: number) => M().SetPlayingRepeatStatus(cur === Repeat.None ? Repeat.All : cur === Repeat.All ? Repeat.Once : Repeat.None),
	seek: (ms: number) => M().SetPlaybackPosition(Math.round(ms)),
	volume: (v: number) => M().SetVolume(Math.round(v)),
};

/** « 3:03 », « 1:02:05 ». */
export function clock(seconds: number): string {
	const s = Math.max(0, Math.floor(seconds));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const r = String(s % 60).padStart(2, '0');
	return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** « 1 h 57 », « 42 min ». */
export function totalLabel(seconds: number): string {
	const m = Math.floor(seconds / 60);
	if (m < 60) return `${Math.max(1, m)} min`;
	return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}
