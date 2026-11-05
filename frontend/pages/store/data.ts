// Données du Magasin : appels au backend (requêtes cross-origin impossibles depuis Steam),
// cache court en mémoire, possession par moi ou par la famille, formats.
import { useEffect, useMemo, useRef, useState } from 'react';
import { findModuleExport } from 'millennium';
import { allApps, lenderOf, Member } from '../../core/steam';
import type { Filters, SortId } from './ui';

// ---------- Types renvoyés par backend/store.lua ----------

export type Deal = {
	appid: number;
	name?: string;
	discount: number;
	final?: number; // centimes
	original?: number; // centimes
	header?: string;
	capsule?: string;
	tags?: string[];
	reviewPct?: number;
	reviewCount?: number;
	reviewScore?: number;
	reviewLabel?: string;
	discountEnd?: number; // horodatage Unix
	lowestRecent?: number;
	free?: boolean;
	priority?: number;
	added?: number;
	/** Ce qu'on met au panier pour acheter le jeu (paquet de l'édition de base, ou lot). */
	packageid?: number;
	bundleid?: number;
	/** Nombre de jeux compris (lot, édition). */
	games?: number;
	/** Sortie (horodatage Unix) ; à venir : `comingSoon`, date annoncée en clair dans `releaseText`. */
	release?: number;
	comingSoon?: boolean;
	releaseText?: string;
	releaseYearOnly?: boolean;
	/** Plus bas historique : aucune source fiable sans clé externe, reste vide tant qu'aucune donnée réelle n'existe. */
	historicalLow?: number;
};

export type SpecialsPage = { ok: boolean; error?: string; total: number; start: number; fetched: number; items: Deal[] };
export type Wishlist = { ok: boolean; error?: string; empty: boolean; count: number; items: Deal[] };
export type Spotlight = { name: string; url: string; image?: string; body?: string };
export type Featured = { ok: boolean; error?: string; spotlights: Spotlight[]; daily?: Deal };

// ---------- Cache (quelques minutes) ----------

const TTL = 10 * 60 * 1000;
const cache = new Map<string, { t: number; p: Promise<any> }>();

function cached<T>(key: string, load: () => Promise<T>, force = false): Promise<T> {
	const hit = cache.get(key);
	if (!force && hit && Date.now() - hit.t < TTL) return hit.p;
	const p = storeReady().then(load).catch((e) => {
		cache.delete(key);
		throw e;
	});
	cache.set(key, { t: Date.now(), p });
	return p;
}

// ---------- Pays et devise du magasin ----------

let country = 'FR';
let currency = 'EUR';
let moneyFormat: Intl.NumberFormat | null = null;
let ready: Promise<void> | null = null;

/** Règle une fois le pays du magasin (celui de l'utilisateur pour Steam) et lit sa devise, avant le premier appel.
 * Sans réponse, le magasin reste celui de la France, en euros (voir backend/store.lua). */
export function storeReady(): Promise<void> {
	if (!ready)
		ready = (async () => {
			try {
				// Développement : localStorage « steamupgraded:storeCountry » (ex. CH) force un autre pays pour tester sa devise
				let forced = '';
				try {
					forced = localStorage.getItem('steamupgraded:storeCountry') || '';
				} catch {}
				const cc = forced || (await (window as any).SteamClient?.User?.GetIPCountry?.());
				const raw: any = await backend.sp_store_set_country(String(cc || ''));
				const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
				if (d?.cc && d?.currency) {
					country = d.cc;
					currency = d.currency;
					moneyFormat = null;
				}
			} catch {}
		})();
	return ready;
}

/** Code du pays du magasin (FR en attendant qu'il soit réglé). */
export function storeCountry(): string {
	return country;
}

/** Pays et devise du magasin, une fois réglés (France et euro en attendant). */
export function useStoreRegion(): { country: string; currency: string; countryName: string; currencyName: string } {
	const [, setTick] = useState(0);
	useEffect(() => {
		let alive = true;
		storeReady().then(() => alive && setTick((n) => n + 1));
		return () => {
			alive = false;
		};
	}, []);
	const name = (type: 'region' | 'currency', code: string) => {
		try {
			return new Intl.DisplayNames(['fr'], { type }).of(code) || code;
		} catch {
			return code;
		}
	};
	return { country, currency, countryName: name('region', country), currencyName: name('currency', currency) };
}

/** Paliers « Prix maximum » (en unités de la devise), comparables d'une devise à l'autre ; null pour une devise non prévue. */
const PRICE_STEPS: Record<string, [number, number, number]> = {
	EUR: [5, 15, 30], USD: [5, 15, 30], GBP: [5, 15, 30], CHF: [5, 15, 30],
	CAD: [7, 20, 40], AUD: [7, 20, 40], NZD: [7, 20, 40], SGD: [7, 20, 40],
	PLN: [20, 60, 120], CZK: [120, 350, 700], NOK: [50, 150, 300], SEK: [50, 150, 300], DKK: [40, 120, 240],
	JPY: [700, 2000, 4000], KRW: [7000, 20000, 40000], CNY: [35, 100, 200], HKD: [40, 120, 240], TWD: [150, 450, 900],
	INR: [400, 1200, 2400], BRL: [25, 75, 150], MXN: [100, 300, 600], ZAR: [90, 270, 540], UAH: [200, 600, 1200], KZT: [2500, 7500, 15000],
	ILS: [20, 60, 120], AED: [20, 60, 120], SAR: [20, 60, 120], QAR: [20, 60, 120],
	THB: [150, 500, 1000], MYR: [25, 70, 140], PHP: [250, 750, 1500], IDR: [75000, 225000, 450000], VND: [125000, 375000, 750000],
	CLP: [5000, 15000, 30000], COP: [20000, 60000, 120000], PEN: [20, 60, 120], UYU: [200, 600, 1200], CRC: [3000, 9000, 18000],
};

export function priceSteps(): [number, number, number] | null {
	return PRICE_STEPS[currency] || null;
}

/** Prix en centimes (Steam compte toutes les devises au centième), dans la devise du magasin. */
export function money(cents?: number): string {
	if (cents == null) return '';
	moneyFormat ??= new Intl.NumberFormat('fr-FR', { style: 'currency', currency });
	return moneyFormat.format(cents / 100);
}

/** Montant rond (palier d'un filtre), sans décimales : « 15 € », « 2 000 ¥ ». */
export function moneyRound(units: number): string {
	return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(units);
}

/** cjson encode une table vide en objet : on ramène tout en tableau. */
function arr<T>(v: any): T[] {
	return Array.isArray(v) ? v : [];
}

async function parse(raw: Promise<string>): Promise<any> {
	// Le pont ffi de Millennium décode déjà une chaîne JSON en objet ; on accepte les deux formes.
	const v: any = await raw;
	const d = typeof v === 'string' ? JSON.parse(v) : v;
	if (!d?.ok) throw new Error(d?.error || 'réponse vide');
	return d;
}

export const PAGE = 100;

export function loadSpecials(start: number, force = false): Promise<SpecialsPage> {
	return cached(`specials:${start}`, async () => {
		const d = await parse(backend.sp_store_specials(start, PAGE));
		return { ...d, items: arr<Deal>(d.items).map(fix) };
	}, force);
}

export function loadWishlist(steamid: string, force = false): Promise<Wishlist> {
	return cached(`wishlist:${steamid}`, async () => {
		const d = await parse(backend.sp_store_wishlist(steamid));
		return { ...d, items: arr<Deal>(d.items).map(fix) };
	}, force);
}

/** Article du panier tel que le magasin le décrit ; `key` vaut « p:<paquet> » ou « b:<lot> ». */
export type CartItem = Deal & { key: string };

/** Noms, images et prix actuels des paquets et lots du panier (le panier lui-même vient de cart.ts). */
export function loadCartItems(targets: { packageid?: number; bundleid?: number }[]): Promise<Map<string, CartItem>> {
	const ids = targets.map(cartKey).sort();
	return cached(`cart:${ids.join(',')}`, async () => {
		const d = await parse(backend.sp_store_cart_items(JSON.stringify(targets.map((t) => (t.packageid ? { packageid: t.packageid } : { bundleid: t.bundleid })))));
		return new Map(arr<any>(d.items).map((it) => [it.key, fix(it) as CartItem]));
	});
}

/** Le paquet ou le lot qui correspond à cet article du panier. */
export function cartKey(t: { packageid?: number; bundleid?: number }): string {
	return t.packageid ? `p:${t.packageid}` : `b:${t.bundleid}`;
}

export function loadFeatured(force = false): Promise<Featured> {
	return cached('featured', async () => {
		const d = await parse(backend.sp_store_featured());
		return { ...d, spotlights: arr<Spotlight>(d.spotlights), daily: d.daily ? fix(d.daily) : undefined };
	}, force);
}

// ---------- Page de vente d'un jeu ----------

export type StoreApp = {
	ok: boolean;
	appid: number;
	name?: string;
	short?: string;
	free?: boolean;
	final?: number;
	original?: number;
	discount: number;
	discountEnd?: number;
	release?: string;
	comingSoon?: boolean;
	developers: string[];
	publishers: string[];
	genres: string[];
	/** Identifiants des catégories Steam (2 solo, 28 manette complète, 62 partage familial…). */
	categories: number[];
	french: 'audio' | 'texte' | 'non';
	tags: string[];
	reviewPct?: number;
	reviewCount?: number;
	reviewScore?: number;
	reviewLabel?: string;
	hero?: string;
	background?: string;
	header?: string;
	achievements?: number;
	metacritic?: number;
	pegi?: string;
	pegiDescriptors: string[];
	screenshots: { thumb: string; full: string }[];
	movies: { thumb: string; name?: string }[];
};

export function loadStoreApp(appid: number, force = false): Promise<StoreApp> {
	return cached(`app:${appid}`, async () => {
		const d = await parse(backend.sp_store_app(appid));
		return {
			...d,
			discount: Number(d.discount) || 0,
			developers: arr<string>(d.developers),
			publishers: arr<string>(d.publishers),
			genres: arr<string>(d.genres),
			categories: arr<number>(d.categories),
			tags: arr<string>(d.tags),
			pegiDescriptors: arr<string>(d.pegiDescriptors),
			screenshots: arr(d.screenshots),
			movies: arr(d.movies),
		};
	}, force);
}

// Catégories Steam affichées dans « Jouer », dans cet ordre (identifiants de appdetails)
export const FEATURES: { id: number; label: string; unless?: number[] }[] = [
	{ id: 2, label: 'Solo' },
	{ id: 38, label: 'Coop en ligne' },
	{ id: 39, label: 'Coop locale' },
	{ id: 9, label: 'Coop', unless: [38, 39] },
	{ id: 36, label: 'JcJ en ligne' },
	{ id: 1, label: 'Multijoueur', unless: [9, 36, 38, 39] },
	{ id: 57, label: 'DualSense' },
	{ id: 28, label: 'Manette complète' },
	{ id: 18, label: 'Manette partielle', unless: [28] },
	{ id: 22, label: 'Succès' },
	{ id: 62, label: 'Partage familial' },
	{ id: 61, label: 'HDR' },
	{ id: 35, label: 'Achats en jeu' },
];

export const FRENCH = {
	audio: ['Voix et textes', 'Interface, sous-titres et doublage'],
	texte: ['Textes', 'Interface et sous-titres, voix dans une autre langue'],
	non: ['Pas en français', 'Ni interface ni sous-titres en français'],
};

/** Étiquettes « Jouer » d'un jeu (solo, coop, manette, succès…), dans l'ordre de FEATURES. */
export function playFeatures(app: StoreApp): string[] {
	return FEATURES.filter((f) => app.categories.includes(f.id) && !(f.unless || []).some((u) => app.categories.includes(u))).map((f) =>
		f.id === 22 && app.achievements ? `Succès (${app.achievements})` : f.label,
	);
}

export function pegiColor(rating?: string) {
	const n = Number(rating);
	return n >= 16 ? 'var(--sp-busy)' : n >= 12 ? 'var(--sp-away)' : 'var(--sp-online)';
}

/** Page du jeu sur le magasin web de Valve. */
export function storeUrl(appid: number) {
	return `https://store.steampowered.com/app/${appid}/`;
}

// ---------- Liste de souhaits : ajouter, retirer ----------

let wishlistService: any = null;

/** Service Wishlist du client Steam (le même que ses propres boutons), appelé avec sa connexion au compte. */
function wishlistApi(): any {
	if (!wishlistService) wishlistService = findModuleExport((e: any) => e && typeof e === 'object' && typeof e.AddToWishlist === 'function' && typeof e.RemoveFromWishlist === 'function');
	return wishlistService;
}

/** Ajoute (`on`) ou retire le jeu de ma liste de souhaits. Renvoie true si Steam a accepté. */
export async function setWishlisted(appid: number, on: boolean): Promise<boolean> {
	const api = wishlistApi();
	const transport = (window as any).App?.m_cm?.m_ServiceTransport;
	if (!api || !transport) return false;
	try {
		const res = await (on ? api.AddToWishlist : api.RemoveFromWishlist)(transport, { appid });
		const ok = res?.GetEResult?.() === 1;
		// la liste en cache n'est plus à jour (magasin, accueil)
		if (ok) cache.delete(`wishlist:${mySteamId()}`);
		return ok;
	} catch (e) {
		console.error('[steam-upgraded] liste de souhaits', e);
		return false;
	}
}

function fix(d: any): Deal {
	return { ...d, discount: Number(d.discount) || 0, tags: arr<string>(d.tags) };
}

export function mySteamId(): string {
	return (window as any).App?.m_CurrentUser?.strSteamID || '';
}

// ---------- Hook de chargement ----------

export type Async<T> = { data?: T; error?: string; loading: boolean };

export function useAsync<T>(load: (force: boolean) => Promise<T>, deps: any[]): [Async<T>, () => void] {
	const [state, setState] = useState<Async<T>>({ loading: true });
	const [nonce, setNonce] = useState(0);
	useEffect(() => {
		let alive = true;
		setState((s) => ({ ...s, loading: true, error: undefined }));
		load(nonce > 0)
			.then((data) => alive && setState({ data, loading: false }))
			.catch((e) => alive && setState({ error: String(e?.message || e), loading: false }));
		return () => {
			alive = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [...deps, nonce]);
	return [state, () => setNonce((n) => n + 1)];
}

// ---------- Promos du moment (pages de 100, communes au bureau et à Big Picture) ----------

/** Charge les `want` premières pages de promos ; changer `force` relit tout sans le cache. */
export function useSpecials(want: number, force: number) {
	const [pages, setPages] = useState<SpecialsPage[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string>();
	const appliedForce = useRef(0);

	useEffect(() => {
		let alive = true;
		// Actualisation demandée : on ignore le cache pour toutes les pages, sinon on le réutilise
		const refresh = force !== appliedForce.current;
		appliedForce.current = force;
		setLoading(true);
		setError(undefined);
		(async () => {
			const out: SpecialsPage[] = [];
			for (let i = 0; i < want; i++) {
				try {
					const p = await loadSpecials(i * PAGE, refresh);
					out.push(p);
					// Les pages déjà affichées sortent du cache : on ne réduit jamais la liste en cours de route
					if (alive) setPages((prev) => (out.length >= prev.length ? [...out] : prev));
					if (p.fetched === 0 || (i + 1) * PAGE >= p.total) break;
				} catch (e: any) {
					if (alive) setError(String(e?.message || e));
					break;
				}
			}
			if (alive) {
				if (out.length) setPages(out);
				setLoading(false);
			}
		})();
		return () => {
			alive = false;
		};
	}, [want, force]);

	const total = pages[0]?.total || 0;
	const deals = useMemo(() => {
		const seen = new Set<number>();
		const out: Deal[] = [];
		for (const p of pages) for (const d of p.items) if (!seen.has(d.appid) && d.discount > 0) (seen.add(d.appid), out.push(d));
		return out;
	}, [pages]);
	const loadedAll = pages.length > 0 && (pages[pages.length - 1].fetched === 0 || pages.length * PAGE >= total);
	return { pages, deals, total, loading, error, loadedAll };
}

/** Promos filtrées puis triées (l'ordre « pertinence » est celui du magasin). */
export function filterDeals(deals: Deal[], f: Filters, sort: SortId, own: Map<number, Owned>): Deal[] {
	const list = deals.filter(
		(d) =>
			d.discount >= f.minDiscount &&
			(!f.maxPrice || (d.final != null && d.final <= f.maxPrice * 100)) &&
			(!f.hideOwned || !own.has(d.appid)) &&
			(!f.positive || reviewScore(d) >= 7),
	);
	const price = (d: Deal) => d.final ?? Infinity;
	if (sort === 'discount') list.sort((a, b) => b.discount - a.discount || price(a) - price(b));
	else if (sort === 'price') list.sort((a, b) => price(a) - price(b) || b.discount - a.discount);
	else if (sort === 'reviews') list.sort((a, b) => reviewScore(b) - reviewScore(a) || (b.reviewPct ?? 0) - (a.reviewPct ?? 0) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
	return list;
}

/** Jeux de la liste de souhaits en promo, meilleure réduction d'abord. */
export function wishlistOnSale(wl?: Wishlist): Deal[] {
	return (wl?.items || []).filter((d) => d.discount > 0 && d.final != null).sort((a, b) => b.discount - a.discount);
}

// ---------- Possession (moi ou la famille) ----------

export type Owned = { kind: 'me' } | { kind: 'family'; member: Member };

/** appid -> possession, d'après la bibliothèque (jeux à moi et jeux prêtés par la famille). */
export function ownershipMap(): Map<number, Owned> {
	const map = new Map<number, Owned>();
	for (const a of allApps()) {
		const lender = lenderOf(a);
		map.set(Number(a.appid), lender ? { kind: 'family', member: lender } : { kind: 'me' });
	}
	return map;
}

// ---------- Formats ----------

const INT = new Intl.NumberFormat('fr-FR');
const DAY = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

export function int(n: number): string {
	return INT.format(n);
}

export function endDate(rt?: number): string {
	if (!rt) return '';
	const ms = rt * 1000 - Date.now();
	if (ms <= 0) return '';
	const h = Math.floor(ms / 3600000);
	if (h < 24) return `encore ${Math.max(1, h)} h`;
	return `jusqu'au ${DAY.format(new Date(rt * 1000))}`;
}

const DAY_LONG = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

/** Fin d'une promo pour une phrase : « dans 18 h », « le 5 novembre » ; vide sans date. */
export function promoEndWhen(rt?: number): string {
	if (!rt) return '';
	const ms = rt * 1000 - Date.now();
	if (ms <= 0) return '';
	const h = Math.floor(ms / 3600000);
	return h < 24 ? `dans ${Math.max(1, h)} h` : `le ${DAY_LONG.format(new Date(rt * 1000))}`;
}

export function plural(n: number, one: string, many: string) {
	return `${int(n)} ${n > 1 ? many : one}`;
}

// Échelle des avis Steam : 9 extrêmement positives … 1 extrêmement négatives.
const LABEL_SCORE: Record<string, number> = {
	'extrêmement positives': 9,
	'très positives': 8,
	positives: 7,
	'plutôt positives': 6,
	moyennes: 5,
	'plutôt négatives': 4,
	négatives: 3,
	'très négatives': 2,
	'extrêmement négatives': 1,
};

export function reviewScore(d: Deal): number {
	if (d.reviewScore) return d.reviewScore;
	return LABEL_SCORE[(d.reviewLabel || '').toLowerCase()] || 0;
}

export function reviewTone(score: number): string {
	if (score >= 6) return 'var(--sp-online)';
	if (score === 5) return 'var(--sp-away)';
	if (score > 0) return 'var(--sp-busy)';
	return 'var(--sp-muted)';
}

export function capitalize(s?: string) {
	return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/** « /sale/BorderlandsFranchiseSale » -> « Borderlands » (nom lisible tiré de l'adresse). */
export function saleSubject(url: string): string {
	const slug = (url.split('?')[0].split('/').filter(Boolean).pop() || '').replace(/\d{4}$/, '');
	const core = slug.replace(/(Franchise|Publisher|Developer|Midweek|Weekend|Daily)?(Sale|Deal|Deals|Fest)$/i, '');
	if (!core || core === slug) return '';
	return core.replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/([0-9])([A-Za-z])/g, '$1 $2').trim();
}
