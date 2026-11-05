// Accès aux données et actions du client Steam (SharedJSContext).
import { MEMBER_COLORS } from './theme';
import { runPrimary } from './machines';

const w = window as any;

export const ROUTES = {
	library: '/steamupgraded/library',
	app: (appid: number | string) => `/steamupgraded/app/${appid}`,
	store: '/steamupgraded/store',
	storeApp: (appid: number | string) => `/steamupgraded/vente/${appid}`,
	wishlist: '/steamupgraded/souhaits',
	cart: '/steamupgraded/panier',
	settings: '/steamupgraded/settings',
	downloads: '/steamupgraded/downloads',
	captures: '/steamupgraded/captures',
	album: (appid: number | string) => `/steamupgraded/album/${appid}`,
	bpHome: '/steamupgraded/bp/home',
	bpLibrary: '/steamupgraded/bp/library',
	bpApp: (appid: number | string) => `/steamupgraded/bp/app/${appid}`,
	bpMenu: '/steamupgraded/bp/menu',
	bpStore: '/steamupgraded/bp/store',
	bpStoreApp: (appid: number | string) => `/steamupgraded/bp/vente/${appid}`,
	bpWishlist: '/steamupgraded/bp/souhaits',
	bpCart: '/steamupgraded/bp/panier',
	bpAchievements: (appid: number | string) => `/steamupgraded/bp/succes/${appid}`,
	bpDownloads: '/steamupgraded/bp/telechargements',
	bpSearch: '/steamupgraded/bp/recherche',
	bpMedia: '/steamupgraded/bp/medias',
	bpAlbum: (appid: number | string) => `/steamupgraded/bp/album/${appid}`,
	bpPlayer: '/steamupgraded/bp/lecteur',
	bpContacts: '/steamupgraded/bp/contacts',
	bpChat: (accountId: number | string) => `/steamupgraded/bp/discussion/${accountId}`,
	bpGroups: '/steamupgraded/bp/groupes',
};

export function mainWindow(): Window | undefined {
	return w.g_PopupManager?.GetExistingPopup?.('SP Desktop_uid0')?.window;
}

/** Fenêtre du bureau. En Big Picture, la liste de Steam peut aussi contenir la fenêtre manette : on l'écarte. */
export function mainRouter(): any {
	const wins: any[] = w.SteamUIStore?.WindowStore?.SteamUIWindows || [];
	return wins.find((x) => x?.IsMainDesktopWindow?.()) || (wins[0]?.IsGamepadUIWindow?.() ? null : wins[0]);
}

export function navigate(path: string) {
	mainRouter()?.Navigate(path);
}

/** Fenêtre principale de Big Picture (absente en mode bureau). */
export function bpRouter(): any {
	return w.SteamUIStore?.WindowStore?.GamepadUIMainWindowInstance;
}

export function bpWindow(): Window | undefined {
	return bpRouter()?.BrowserWindow;
}

export function bpNavigate(path: string) {
	bpRouter()?.Navigate(path);
}

/** Dernière page web de Valve ouverte par nous (history.ts ne redirige pas celle-là vers nos pages). */
export const ourWebOpen = { url: '', at: 0 };

export function openSteamWeb(url: string) {
	ourWebOpen.url = url;
	ourWebOpen.at = Date.now();
	mainRouter()?.NavigateToSteamWeb(url);
}

// ---------- Compte et famille ----------

const STEAMID64_BASE = BigInt('76561197960265728');

export function myAccountId(): number {
	const id = w.App?.m_CurrentUser?.strSteamID;
	return id ? Number(BigInt(id) - STEAMID64_BASE) : 0;
}

function friendsStore(): any {
	return w.friendStore?.m_FriendsUIFriendStore;
}

export function playerName(accountId: number): string {
	return friendsStore()?.m_mapPlayerCache?.get(accountId)?.m_persona?.m_strPlayerName || `Compte ${accountId}`;
}

/** Avatar par défaut de Steam (point d'interrogation), donné aussi le temps que le profil se charge. */
const DEFAULT_AVATAR = 'fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb';

export function avatarUrl(accountId: number): string | undefined {
	const hash = friendsStore()?.m_mapPlayerCache?.get(accountId)?.m_persona?.m_strAvatarHash;
	return hash && !/^0+$/.test(hash) && hash !== DEFAULT_AVATAR ? `https://avatars.steamstatic.com/${hash}_medium.jpg` : undefined;
}

export type Member = { accountId: number; name: string; initial: string; color: string; isMe: boolean };

let memberIds: number[] | null = null;

/** Membres de la famille déduits des propriétaires des jeux prêtés.
 * Les identifiants sont mis en cache ; les noms sont relus à chaque appel (les profils se chargent après le démarrage). */
export function familyMembers(): Map<number, Member> {
	if (!memberIds?.length) {
		const me = myAccountId();
		const ids = new Set<number>();
		for (const a of allApps()) if (a.owner_account_id && a.owner_account_id !== me) ids.add(a.owner_account_id);
		memberIds = [...ids].sort((x, y) => x - y);
	}
	const map = new Map<number, Member>();
	memberIds.forEach((id, i) => {
		const name = playerName(id);
		map.set(id, { accountId: id, name, initial: name.charAt(0).toUpperCase(), color: MEMBER_COLORS[i % MEMBER_COLORS.length], isMe: false });
	});
	return map;
}

/** Propriétaire de la clé si le jeu est prêté par un autre membre, sinon null. */
export function lenderOf(app: any): Member | null {
	const id = app?.owner_account_id;
	if (!id || id === myAccountId()) return null;
	return familyMembers().get(id) || null;
}

// ---------- Jeux et collections ----------

/** Type d'un jeu ajouté hors de Steam (EAppType). */
const SHORTCUT = 1073741824;

/**
 * Tous les jeux de la bibliothèque. En Big Picture, la collection « tous les jeux » de Steam laisse de côté les jeux
 * ajoutés hors de Steam (elle les inclut au bureau) : on les reprend de la collection par type, sauf s'ils sont masqués.
 */
export function allApps(): any[] {
	const store = w.collectionStore;
	const apps: any[] = store?.allGamesCollection?.allApps || [];
	const byType: any[] = store?.GetCollection?.('type-games')?.allApps || [];
	if (byType.length <= apps.length) return apps;
	const have = new Set(apps.map((a) => a.appid));
	const hidden = new Set((store?.GetCollection?.('hidden')?.allApps || []).map((a: any) => a.appid));
	const extra = byType.filter((a) => a.app_type === SHORTCUT && !have.has(a.appid) && !hidden.has(a.appid));
	return extra.length ? apps.concat(extra) : apps;
}

export function appById(appid: number): any {
	return w.appStore?.GetAppOverviewByAppID?.(Number(appid));
}

export type Collection = { id: string; name: string; apps: any[]; dynamic: boolean };

export function userCollections(): Collection[] {
	return [...(w.collectionStore?.userCollections || [])]
		.filter((c: any) => !String(c.id).startsWith('type-') && c.id !== 'uncategorized')
		.map((c: any) => ({ id: c.id, name: c.displayName, apps: c.allApps || [], dynamic: !!c.bIsDynamic }));
}

// Visuels d'origine. Les visuels personnalisés passent par useArt() (core/art.ts),
// car Steam donne deux adresses possibles (.jpg/.png) dont une seule existe.

export function coverUrl(app: any): string {
	return w.appStore?.GetVerticalCapsuleURLForApp?.(app) || `https://shared.steamstatic.com/store_item_assets/steam/apps/${app.appid}/library_600x900.jpg`;
}

export function heroUrl(app: any): string {
	return `https://shared.steamstatic.com/store_item_assets/steam/apps/${app.appid}/library_hero.jpg`;
}

export function logoUrl(app: any): string {
	return `https://shared.steamstatic.com/store_item_assets/steam/apps/${app.appid}/logo.png`;
}

export function landscapeUrl(app: any): string {
	// les jeux récents n'ont qu'un en-tête au nom haché (header.jpg renvoie 404) : Steam donne ce nom
	return `https://shared.steamstatic.com/store_item_assets/steam/apps/${app.appid}/${app.header_filename || 'header.jpg'}`;
}

export function formatHours(minutes: number): string {
	if (!minutes) return '0 h';
	if (minutes < 60) return `${minutes} min`;
	const h = minutes / 60;
	return h < 10 ? `${h.toFixed(1).replace('.', ',')} h` : `${Math.round(h)} h`;
}

export function formatLastPlayed(rt: number): string {
	if (!rt) return 'jamais lancé';
	const days = Math.floor((Date.now() / 1000 - rt) / 86400);
	if (days <= 0) return "aujourd'hui";
	if (days === 1) return 'hier';
	if (days < 7) return `il y a ${days} j`;
	if (days < 31) return `il y a ${Math.round(days / 7)} sem.`;
	if (days < 365) return `il y a ${Math.round(days / 30)} mois`;
	const y = Math.round(days / 365);
	return `il y a ${y} an${y > 1 ? 's' : ''}`;
}

// ---------- Actions sur un jeu ----------

/** Action principale du jeu sur l'ordinateur devant soi (voir core/machines.ts : jouer, installer ou streamer). */
export function playOrInstall(app: any) {
	runPrimary(app);
}

export function openProperties(app: any) {
	w.SteamClient.Apps.OpenAppSettingsDialog(app.appid, '');
}

/** Notre page de vente du jeu (le paiement, lui, se fait sur la page de Valve). */
export function openStorePage(appid: number) {
	navigate(ROUTES.storeApp(appid));
}

// ---------- Présence ----------

export const PRESENCE = [
	{ state: 1, label: 'En ligne', sub: 'Visible, notifications actives', color: 'var(--sp-online)' },
	{ state: 3, label: 'Absence', sub: 'Visible, avec un statut d’absence', color: 'var(--sp-away)' },
	{ state: 2, label: 'Ne pas déranger', sub: 'Visible, sans notification', color: 'var(--sp-busy)' },
	{ state: 7, label: 'Invisible', sub: 'Vos contacts restent visibles, pas vous', color: '#8a93a3' },
	{ state: 0, label: 'Hors ligne', sub: 'Hors du chat', color: '#4a5260' },
];

export function presenceState(): number {
	return friendsStore()?.m_eUserPersonaState ?? 1;
}

export function setPresence(state: number) {
	friendsStore()?.SetUserPersonaState(state, true);
}

let returnTimer: any = null;

/** Repasse « En ligne » après `minutes` (0 : jamais), sauf si la présence a changé entre-temps (depuis Steam, par exemple). */
export function schedulePresenceReturn(minutes: number, from: number) {
	clearTimeout(returnTimer);
	if (minutes > 0 && from !== 1) returnTimer = setTimeout(() => presenceState() === from && setPresence(1), minutes * 60000);
}

export function selfPersona(): { name: string; avatar?: string; accountId: number } {
	const self = friendsStore()?.m_self;
	return {
		name: self?.m_persona?.m_strPlayerName || '',
		avatar: avatarUrl(myAccountId()),
		accountId: myAccountId(),
	};
}
