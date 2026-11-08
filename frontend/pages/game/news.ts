// Mises à jour et actualités d'un jeu (événements de sa page communautaire, backend.sp_app_news), partagées par la fiche
// et la page de vente, au bureau comme en Big Picture. Gardées le temps de la session (10 min).
import { useEffect, useState } from 'react';

export type NewsItem = {
	gid: string;
	/** 12 petite mise à jour, 13 mise à jour, 14 mise à jour majeure ; autres : actualités, évènements. */
	type: number;
	title: string;
	time: number;
	/** Langue de Steam (2 = français). */
	lang: number;
	body: string;
	url: string;
};

export type NewsFilter = 'updates' | 'all';

type Entry = { items: NewsItem[]; nextOffset: number; more: boolean; at: number };

const cache = new Map<string, Entry>();
const TTL = 10 * 60 * 1000;
/** Pages lues d'affilée au plus pour remplir l'écran quand le filtre écarte presque tout. */
const FILL_PAGES = 3;
const WANT = 6;

export function newsKind(type: number): string {
	if (type === 14) return 'Mise à jour majeure';
	if (type === 13) return 'Mise à jour';
	if (type === 12) return 'Petite mise à jour';
	return 'Actualité';
}

export function newsPageUrl(appid: number): string {
	return `https://store.steampowered.com/news/app/${appid}`;
}

async function fetchPage(appid: number, offset: number, filter: NewsFilter): Promise<{ items: NewsItem[]; nextOffset: number; more: boolean }> {
	const raw: any = await (backend as any).sp_app_news(appid, offset, filter === 'updates');
	const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
	if (!d?.ok) throw new Error(d?.error || 'actualités indisponibles');
	const items: NewsItem[] = (Array.isArray(d.items) ? d.items : []).map((it: any) => ({
		gid: String(it.gid || ''),
		type: Number(it.type) || 0,
		title: String(it.title || ''),
		time: Number(it.time) || 0,
		lang: Number(it.lang) || 0,
		body: String(it.body || ''),
		url: it.announcement ? `${newsPageUrl(appid)}/view/${it.announcement}` : newsPageUrl(appid),
	}));
	return { items, nextOffset: Number(d.nextOffset) || offset, more: !!d.more };
}

/** Lit des pages jusqu'à avoir `want` éléments de plus (ou plus rien), sans dépasser FILL_PAGES. */
async function grow(appid: number, filter: NewsFilter, from: Entry, want: number): Promise<Entry> {
	let e = { ...from, items: [...from.items] };
	const target = e.items.length + want;
	for (let i = 0; i < FILL_PAGES && e.more && e.items.length < target; i++) {
		const p = await fetchPage(appid, e.nextOffset, filter);
		const seen = new Set(e.items.map((x) => x.gid));
		e = { items: [...e.items, ...p.items.filter((x) => !seen.has(x.gid))], nextOffset: p.nextOffset, more: p.more, at: Date.now() };
	}
	return e;
}

export type News = { items: NewsItem[]; loading: boolean; error: string; more: boolean; loadMore: () => void; retry: () => void };

export function useAppNews(appid: number, filter: NewsFilter, enabled = true): News {
	const key = `${appid}:${filter}`;
	const [state, set] = useState<{ key: string; entry: Entry | null; loading: boolean; error: string }>(() => ({ key, entry: cache.get(key) || null, loading: false, error: '' }));
	const [tick, setTick] = useState(0);

	const load = (from: Entry | null, want: number) => {
		let alive = true;
		set((s) => ({ ...s, key, loading: true, error: '' }));
		grow(appid, filter, from || { items: [], nextOffset: 0, more: true, at: 0 }, want)
			.then((e) => {
				cache.set(key, e);
				if (alive) set({ key, entry: e, loading: false, error: '' });
			})
			.catch((err) => {
				console.error('[steam-upgraded] actualités du jeu indisponibles', appid, err);
				if (alive) set((s) => ({ ...s, key, loading: false, error: String(err?.message || err) }));
			});
		return () => {
			alive = false;
		};
	};

	useEffect(() => {
		if (!enabled || !appid) return undefined;
		const hit = cache.get(key);
		if (hit && Date.now() - hit.at < TTL) {
			set({ key, entry: hit, loading: false, error: '' });
			return undefined;
		}
		set({ key, entry: null, loading: true, error: '' });
		return load(null, WANT);
	}, [key, enabled, tick]);

	const entry = state.key === key ? state.entry : null;
	return {
		items: entry?.items || [],
		loading: state.key === key ? state.loading : true,
		error: state.key === key ? state.error : '',
		more: !!entry?.more,
		loadMore: () => {
			if (entry && entry.more && !state.loading) load(entry, 10);
		},
		retry: () => {
			cache.delete(key);
			setTick((t) => t + 1);
		},
	};
}

const DAY = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const DAY_YEAR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const REL = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });

/** « 5 nov. » (avec l'année si ce n'est pas l'année en cours). */
export function newsDate(t: number): string {
	const d = new Date(t * 1000);
	return (d.getFullYear() === new Date().getFullYear() ? DAY : DAY_YEAR).format(d);
}

/** « aujourd’hui », « il y a 3 jours », « il y a 2 mois »… */
export function newsAgo(t: number): string {
	const days = Math.round((Date.now() / 1000 - t) / 86400);
	if (days < 1) return REL.format(0, 'day');
	if (days < 31) return REL.format(-days, 'day');
	if (days < 365) return REL.format(-Math.round(days / 30.4), 'month');
	return REL.format(-Math.round(days / 365), 'year');
}
