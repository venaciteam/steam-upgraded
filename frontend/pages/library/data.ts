// Données de la page Bibliothèque : instantané figé des objets MobX de Steam,
// relu au montage, au retour sur la fenêtre et toutes les 30 s (sans re-rendu si rien n'a changé).
import { useCallback, useEffect, useState } from 'react';
import { artStamp, onArtChanged } from '../../core/art';
import {
	allApps,
	avatarUrl,
	coverUrl,
	familyMembers,
	landscapeUrl,
	lenderOf,
	mainWindow,
	myAccountId,
	playerName,
	selfPersona,
	userCollections,
} from '../../core/steam';

export type Lender = { accountId: number; name: string; color: string };

export type Game = {
	appid: number;
	name: string;
	sortKey: string;
	search: string;
	mins: number;
	mins2w: number;
	last: number;
	purchased: number;
	installed: boolean;
	lender: Lender | null;
	/** Nombre de copies dans la Famille Steam (1 si une seule). */
	copies: number;
	/** Version des visuels personnalisés (0 = aucun) : fait relire la jaquette quand elle change. */
	art: number;
	cover: string;
	landscape: string;
	app: any;
};

export type Coll = { id: string; name: string; ids: Set<number> };

export type Person = { accountId: number; name: string; initial: string; color: string; avatar?: string; isMe: boolean };

/** Collections de Steam hors de « Tous les jeux » : jeux masqués et bandes-son. */
export type NativeId = 'hidden' | 'music';

export const NATIVE: { id: NativeId; steamId: string; label: string }[] = [
	{ id: 'music', steamId: 'type-music', label: 'Bandes-son' },
	{ id: 'hidden', steamId: 'hidden', label: 'Jeux masqués' },
];

export type Library = { games: Game[]; collections: Coll[]; people: Person[]; native: Record<NativeId, Game[]>; maxMins: number; sig: string };

const EMPTY: Library = { games: [], collections: [], people: [], native: { hidden: [], music: [] }, maxMins: 0, sig: '' };

export function normalize(s: string): string {
	return (s || '')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase();
}

function readLibrary(): Library {
	const games: Game[] = [];
	const sigParts: string[] = [];
	const lenderNames = new Map<number, string>();
	let maxMins = 0;
	const toGame = (app: any): Game => {
		const m = lenderOf(app);
		let lender: Lender | null = null;
		if (m) {
			let name = lenderNames.get(m.accountId);
			if (!name) lenderNames.set(m.accountId, (name = playerName(m.accountId)));
			lender = { accountId: m.accountId, name, color: m.color };
		}
		const name = app.display_name || `App ${app.appid}`;
		const g: Game = {
			appid: app.appid,
			name,
			sortKey: normalize(app.sort_as || name),
			search: normalize(name),
			mins: app.minutes_playtime_forever || 0,
			mins2w: app.minutes_playtime_last_two_weeks || 0,
			last: app.rt_last_time_played || 0,
			purchased: app.rt_purchased_time || 0,
			installed: !!app.installed,
			lender,
			copies: Math.max(1, Number(app.number_of_copies) || 1),
			art: artStamp(app),
			cover: coverUrl(app),
			landscape: landscapeUrl(app),
			app,
		};
		sigParts.push(`${g.appid}:${g.mins}:${g.mins2w}:${g.last}:${g.installed ? 1 : 0}:${g.cover}:${g.landscape}:${lender?.name || ''}:${g.copies}:${g.art}`);
		return g;
	};
	for (const app of allApps()) {
		const g = toGame(app);
		if (g.mins > maxMins) maxMins = g.mins;
		games.push(g);
	}
	const native = {} as Record<NativeId, Game[]>;
	for (const n of NATIVE) {
		sigParts.push(`n:${n.id}`);
		native[n.id] = (nativeCollection(n.steamId)?.allApps || []).map(toGame);
	}

	const collections: Coll[] = userCollections().map((c) => {
		const ids = new Set<number>(c.apps.map((a: any) => a.appid));
		sigParts.push(`c:${c.id}:${c.name}:${[...ids].join(',')}`);
		return { id: c.id, name: c.name, ids };
	});

	const self = selfPersona();
	const people: Person[] = [
		{ accountId: myAccountId(), name: self.name || 'Moi', initial: (self.name || 'M').charAt(0).toUpperCase(), color: 'var(--sp-accent)', avatar: self.avatar, isMe: true },
	];
	for (const m of familyMembers().values()) {
		const name = lenderNames.get(m.accountId) || playerName(m.accountId);
		people.push({ accountId: m.accountId, name, initial: name.charAt(0).toUpperCase(), color: m.color, avatar: avatarUrl(m.accountId), isMe: false });
	}
	sigParts.push(people.map((p) => `${p.accountId}:${p.name}:${p.avatar || ''}`).join('|'));

	return { games, collections, people, native, maxMins, sig: sigParts.join(';') };
}

/** Instantané de la bibliothèque, rafraîchi légèrement. `refresh()` force une relecture. */
export function useLibrary(): [Library, () => void] {
	const [lib, setLib] = useState<Library>(() => {
		try {
			return readLibrary();
		} catch (e) {
			console.error('[steam-upgraded] lecture de la bibliothèque impossible', e);
			return EMPTY;
		}
	});

	const refresh = useCallback(() => {
		try {
			const next = readLibrary();
			setLib((prev) => (prev.sig === next.sig ? prev : next));
		} catch (e) {
			console.error('[steam-upgraded] lecture de la bibliothèque impossible', e);
		}
	}, []);

	useEffect(() => {
		const win = mainWindow();
		const onFocus = () => refresh();
		const onVisible = () => {
			if (win?.document?.visibilityState === 'visible') refresh();
		};
		win?.addEventListener('focus', onFocus);
		win?.document?.addEventListener('visibilitychange', onVisible);
		const t = setInterval(refresh, 30000);
		const offArt = onArtChanged(refresh);
		// Les magasins Steam peuvent finir de se remplir juste après le montage
		const t0 = setTimeout(refresh, 1500);
		// Après un changement de mode (bureau, Big Picture), Steam remplit sa liste peu à peu, sans que la fenêtre
		// du bureau reprenne le focus en Big Picture : contrôle léger (nombre de jeux et d'installés), relecture si besoin.
		let quick = -1;
		const tq = setInterval(() => {
			const apps = allApps();
			let k = apps.length * 10000;
			for (const a of apps) if (a.installed) k++;
			if (quick >= 0 && k !== quick) refresh();
			quick = k;
		}, 2000);
		return () => {
			clearInterval(t);
			clearInterval(tq);
			clearTimeout(t0);
			offArt();
			win?.removeEventListener('focus', onFocus);
			win?.document?.removeEventListener('visibilitychange', onVisible);
		};
	}, [refresh]);

	return [lib, refresh];
}

function nativeCollection(steamId: string): any {
	return (window as any).collectionStore?.GetCollection?.(steamId);
}

// Collection demandée de l'extérieur (route native /library/collection/<id> redirigée vers notre page)
let requested: string | null = null;
const requestListeners = new Set<(id: string) => void>();

export function requestCollection(steamId: string) {
	requested = steamId;
	requestListeners.forEach((fn) => fn(steamId));
}

/** Sélection correspondant à une collection de Steam (null si elle n'a pas de vue chez nous). */
export function selectionForCollection(steamId: string, lib: Library): Selection | null {
	const n = NATIVE.find((x) => x.steamId === steamId);
	if (n) return { kind: 'native', id: n.id };
	return lib.collections.some((c) => c.id === steamId) ? { kind: 'coll', id: steamId } : null;
}

export function takeRequestedCollection(): string | null {
	const r = requested;
	requested = null;
	return r;
}

export function onCollectionRequested(fn: (id: string) => void): () => void {
	requestListeners.add(fn);
	return () => {
		requestListeners.delete(fn);
	};
}

// ---------- Filtres et tris ----------

export type ViewId = 'all' | 'recent' | 'never' | 'installed' | 'borrowed' | 'multi';
export type Selection = { kind: 'view'; id: ViewId } | { kind: 'coll'; id: string } | { kind: 'person'; id: number } | { kind: 'native'; id: NativeId };
export type SortId = 'playtime' | 'last' | 'name' | 'purchased';
export type Pill = 'installed' | 'mine' | 'borrowed';

export const VIEWS: { id: ViewId; label: string }[] = [
	{ id: 'all', label: 'Tous les jeux' },
	{ id: 'recent', label: 'En cours' },
	{ id: 'never', label: 'Jamais lancés' },
	{ id: 'installed', label: 'Installés' },
	{ id: 'borrowed', label: 'Prêtés par la famille' },
	{ id: 'multi', label: 'Plusieurs copies' },
];

export const SORTS: { id: SortId; label: string }[] = [
	{ id: 'playtime', label: 'Temps de jeu' },
	{ id: 'last', label: 'Dernier lancement' },
	{ id: 'name', label: 'Nom' },
	{ id: 'purchased', label: "Date d'achat" },
];

const TWO_WEEKS = 14 * 86400;

export function viewTest(id: ViewId): (g: Game) => boolean {
	const since = Date.now() / 1000 - TWO_WEEKS;
	switch (id) {
		case 'recent':
			return (g) => g.mins2w > 0 || g.last >= since;
		case 'never':
			return (g) => !g.last && !g.mins;
		case 'installed':
			return (g) => g.installed;
		case 'borrowed':
			return (g) => !!g.lender;
		case 'multi':
			return (g) => g.copies > 1;
		default:
			return () => true;
	}
}

export function selectionTest(sel: Selection, lib: Library): (g: Game) => boolean {
	if (sel.kind === 'view') return viewTest(sel.id);
	if (sel.kind === 'native') return () => true;
	if (sel.kind === 'coll') {
		const ids = lib.collections.find((c) => c.id === sel.id)?.ids;
		return ids ? (g) => ids.has(g.appid) : () => false;
	}
	const me = lib.people.find((p) => p.accountId === sel.id)?.isMe;
	return me ? (g) => !g.lender : (g) => g.lender?.accountId === sel.id;
}

export function pillTest(p: Pill): (g: Game) => boolean {
	if (p === 'installed') return (g) => g.installed;
	if (p === 'mine') return (g) => !g.lender;
	return (g) => !!g.lender;
}

export function sortGames(list: Game[], by: SortId): Game[] {
	const byName = (a: Game, b: Game) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0);
	const out = list.slice();
	if (by === 'name') return out.sort(byName);
	const key: (g: Game) => number = by === 'playtime' ? (g) => g.mins : by === 'last' ? (g) => g.last : (g) => g.purchased;
	return out.sort((a, b) => key(b) - key(a) || byName(a, b));
}

// ---------- Propriétaires d'un jeu (Famille Steam) ----------

export type Owner = { accountId: number; name: string; color: string; isMe: boolean; preferred: boolean };

const STEAMID64_BASE = BigInt('76561197960265728');
const ownersCache = new Map<number, { at: number; p: Promise<Owner[]> }>();
const OWNERS_TTL = 30000;

/** Oublie les propriétaires mis en cache (après un changement de copie utilisée). */
export function forgetOwners(appid: number) {
	ownersCache.delete(appid);
}

/** Tous les propriétaires d'un jeu (moi compris) et la copie utilisée par défaut. Mis en cache 30 s par appid. */
export function loadOwners(appid: number): Promise<Owner[]> {
	const hit = ownersCache.get(appid);
	if (hit && Date.now() - hit.at < OWNERS_TTL) return hit.p;
	const p = (async () => {
		const list: any[] = (await (window as any).SteamClient?.FamilySharing?.GetAvailableLenders?.(appid)) || [];
		const me = myAccountId();
		const members = familyMembers();
		const out: Owner[] = list.map((l) => {
			const id = Number(BigInt(l.steamid) - STEAMID64_BASE);
			const m = members.get(id);
			return { accountId: id, name: id === me ? 'vous' : m?.name || playerName(id), color: id === me ? 'var(--sp-accent)' : m?.color || 'var(--sp-muted)', isMe: id === me, preferred: !!l.bPreferred };
		});
		// Moi d'abord, puis par nom
		return out.sort((a, b) => Number(b.isMe) - Number(a.isMe) || a.name.localeCompare(b.name, 'fr'));
	})();
	p.catch(() => ownersCache.delete(appid));
	ownersCache.set(appid, { at: Date.now(), p });
	return p;
}

// ---------- Formats ----------

/** Heures entières avec séparateur de milliers (« 1 234 h »), ou minutes sous une heure. */
export function formatBigHours(minutes: number): string {
	if (!minutes) return '0 h';
	if (minutes < 60) return `${minutes} min`;
	const h = minutes / 60;
	if (h < 10) return `${h.toFixed(1).replace('.', ',')} h`;
	return `${formatInt(Math.round(h))} h`;
}

/** Entier avec espace fine insécable entre les milliers (la locale fr n'est pas garantie dans Steam). */
export function formatInt(n: number): string {
	return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
}

/** « Clé de Camille », « Clé d'Alex » (élision devant une voyelle). */
export function keyOf(name: string): string {
	return /^[aeiouyàâäéèêëîïôöùûü]/i.test(name) ? `Clé d'${name}` : `Clé de ${name}`;
}

export function plural(n: number, one: string, many: string): string {
	return `${formatInt(n)} ${n > 1 ? many : one}`;
}
