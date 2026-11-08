// Données de la fiche d'un jeu : détails Steam, succès, famille, amis, relevés de temps de jeu.
import { pluginConfig } from 'millennium';
import { ActionKind, GameAction, gameActions, gameSize, sizeLabel } from '../../core/machines';
import { useEffect, useState } from 'react';
import { appById, avatarUrl, familyMembers, myAccountId, playerName } from '../../core/steam';
import { currentPath, usePath } from '../../core/history';

const w = window as any;
const STEAMID64_BASE = BigInt('76561197960265728');

export function accountIdOf(steamid64: string): number {
	try {
		return Number(BigInt(steamid64) - STEAMID64_BASE);
	} catch {
		return 0;
	}
}

/** Raccourci hors Steam (appid sur 32 bits avec le bit haut). */
export function isShortcut(appid: number): boolean {
	return appid >= 0x80000000;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
	return Promise.race([p, new Promise<undefined>((r) => setTimeout(() => r(undefined), ms))]);
}

/**
 * Nom d'un compte, relu à chaque rendu : le cache des membres de core/steam.ts peut
 * avoir figé « Compte <id> » si les profils n'étaient pas encore chargés.
 */
export function liveName(accountId: number, fallback?: string): string {
	const n = playerName(accountId);
	return n.startsWith('Compte ') && fallback && !fallback.startsWith('Compte ') ? fallback : n;
}

// ---------- Appid de la route ----------

export function useRouteAppId(props: any): number {
	const path = usePath();
	const fromProps = props?.match?.params?.appid;
	if (fromProps && /^\d+$/.test(String(fromProps))) return Number(fromProps);
	const m = (path || currentPath()).match(/\/steamupgraded\/app\/(\d+)/);
	return m ? Number(m[1]) : 0;
}

// ---------- Jeu et détails (mis à jour en direct) ----------

/** Vue d'ensemble + détails du jeu ; se redessine quand Steam signale un changement. */
export function useGame(appid: number): { app: any; details: any; tick: number } {
	const [tick, setTick] = useState(0);
	useEffect(() => {
		if (!appid || isShortcut(appid)) return undefined;
		let reg: any = null;
		try {
			reg = w.appDetailsStore?.RegisterForAppData?.(appid, () => setTick((t) => t + 1));
		} catch (e) {
			console.error('[steam-upgraded] détails du jeu indisponibles', appid, e);
		}
		// L'état d'installation vit dans la vue d'ensemble : on la relit régulièrement.
		const iv = setInterval(() => setTick((t) => t + 1), 4000);
		return () => {
			clearInterval(iv);
			try {
				reg?.unregister?.();
			} catch {}
		};
	}, [appid]);
	const app = appid ? appById(appid) : null;
	const details = appid && !isShortcut(appid) ? w.appDetailsStore?.GetAppDetails?.(appid) : null;
	return { app, details, tick };
}

// ---------- Taille du jeu ----------

/**
 * Taille lisible d'un jeu (espace occupé, ou nécessaire s'il n'est pas installé : core/machines.ts). Les détails d'un
 * jeu non installé ne sont chargés par Steam qu'à la demande : on les demande le temps que le composant existe
 * (carte de survol au bureau, tuile focalisée en Big Picture), jamais pour toute la bibliothèque.
 */
export function useGameSize(app: any): { size: string; installed: boolean } {
	const [, setTick] = useState(0);
	const appid = Number(app?.appid || 0);
	const { bytes, installed } = gameSize(app);
	useEffect(() => {
		if (!appid || bytes > 0 || isShortcut(appid)) return undefined;
		let reg: any = null;
		try {
			reg = w.appDetailsStore?.RegisterForAppData?.(appid, () => setTick((t) => t + 1));
		} catch {}
		return () => {
			try {
				reg?.unregister?.();
			} catch {}
		};
	}, [appid, bytes > 0]);
	return { size: sizeLabel(bytes), installed };
}

// ---------- Bouton principal ----------

/** `downloading` : téléchargement ou mise à jour en cours sur cet ordinateur (le bouton du bureau mène aux téléchargements). */
export type PrimaryState = { label: string; disabled: boolean; hint?: string; kind: ActionKind; choices: GameAction[]; downloading?: boolean };

const UPDATE_STATES = new Set([18, 19, 20, 21, 39]);

/**
 * Bouton principal d'un jeu : l'action sur l'ordinateur devant soi (core/machines.ts), avec les états en cours
 * (lancement, téléchargement…) de la machine visée. `choices` : toutes les possibilités, pour la flèche du bouton.
 */
export function primaryState(app: any): PrimaryState {
	const { primary, choices } = gameActions(app);
	const base = { kind: primary.kind, choices };
	const ds = Number(primary.machine ? primary.machine.displayStatus : (app?.display_status ?? 0));
	if (ds === 4) return { ...base, label: 'En cours', disabled: true, hint: 'Le jeu est lancé' };
	if (ds === 1) return { ...base, label: 'Lancement…', disabled: true };
	if (ds === 36) return { ...base, label: 'Fermeture…', disabled: true };
	if (ds === 37) return { ...base, label: 'Copie utilisée', disabled: true, hint: 'Le propriétaire joue en ce moment' };
	if (ds === 17) return { ...base, label: 'Copie utilisée', disabled: true, hint: 'Un autre membre de la famille joue sur cette copie' };
	if (primary.kind === 'play' || primary.kind === 'install' || primary.kind === 'remote-install') {
		if (ds === 3 || ds === 7 || ds === 23 || ds === 22) return { ...base, label: 'Téléchargement…', disabled: true, downloading: true, hint: 'Voir dans les téléchargements' };
		if (ds === 6) return { ...base, label: 'Mise à jour…', disabled: true, downloading: true, hint: 'Voir dans les téléchargements' };
		if (primary.kind === 'play' && UPDATE_STATES.has(ds)) return { ...base, label: 'Mettre à jour', disabled: false };
	}
	if (primary.kind === 'unavailable') return { ...base, label: primary.label, disabled: true, hint: 'Ce jeu n’existe pas pour ce système' };
	return { ...base, label: primary.label, disabled: false };
}

// ---------- Visuels avec repli ----------

export function heroCandidates(app: any, primary: string): string[] {
	const list = [primary];
	try {
		const r = w.appDetailsStore?.GetHeroImagesForAppId?.(app.appid);
		if (r?.rgHeroImages) list.push(...r.rgHeroImages);
	} catch {}
	return [...new Set(list.filter(Boolean))];
}

export function logoCandidates(app: any, primary: string): string[] {
	const list = [primary];
	try {
		const r = w.appDetailsStore?.GetLogoImagesForAppId?.(app.appid);
		if (r?.rgLogoImages) list.push(...r.rgLogoImages);
	} catch {}
	return [...new Set(list.filter(Boolean))];
}

// ---------- Succès ----------

export type Achievement = { id: string; name: string; description: string; achieved: boolean; unlocked: number; image: string; hidden: boolean };
export type Achievements = { total: number; achieved: number; recent: Achievement[] } | null;

export function useAchievements(appid: number): { data: Achievements; loading: boolean } {
	const [state, set] = useState<{ data: Achievements; loading: boolean }>({ data: null, loading: true });
	useEffect(() => {
		let alive = true;
		set({ data: null, loading: true });
		if (!appid || isShortcut(appid)) {
			set({ data: null, loading: false });
			return undefined;
		}
		(async () => {
			try {
				const r: any = await withTimeout(w.SteamClient.Apps.GetMyAchievementsForApp(String(appid)), 10000);
				if (!alive) return;
				const list: any[] = r?.result === 1 ? r?.data?.rgAchievements || [] : [];
				if (r?.result !== 1) {
					set({ data: null, loading: false });
					return;
				}
				const all: Achievement[] = list.map((a) => ({
					id: String(a.strID),
					name: a.strName,
					description: a.strDescription,
					achieved: !!a.bAchieved,
					unlocked: a.rtUnlocked || 0,
					image: a.strImage,
					hidden: !!a.bHidden,
				}));
				const got = all.filter((a) => a.achieved);
				const recent = [...got].sort((a, b) => b.unlocked - a.unlocked).slice(0, 3);
				set({ data: { total: all.length, achieved: got.length, recent }, loading: false });
			} catch (e) {
				console.error('[steam-upgraded] succès indisponibles', appid, e);
				if (alive) set({ data: null, loading: false });
			}
		})();
		return () => {
			alive = false;
		};
	}, [appid]);
	return state;
}

// ---------- Famille ----------

export type Copy = { accountId: number; name: string; color?: string; isMe: boolean; preferred: boolean };

/** Copies du jeu dans la famille (SteamClient.FamilySharing.GetAvailableLenders). `version` force une relecture. */
export function useLenders(appid: number, version = 0): Copy[] | null {
	const [copies, set] = useState<Copy[] | null>(null);
	useEffect(() => {
		let alive = true;
		set(null);
		if (!appid || isShortcut(appid)) return undefined;
		(async () => {
			try {
				const list: any[] = (await withTimeout(w.SteamClient.FamilySharing.GetAvailableLenders(appid), 8000)) || [];
				if (!alive) return;
				const me = myAccountId();
				const members = familyMembers();
				set(
					list.map((l) => {
						const id = accountIdOf(l.steamid);
						const m = members.get(id);
						return { accountId: id, name: id === me ? 'Vous' : m?.name || playerName(id), color: m?.color, isMe: id === me, preferred: !!l.bPreferred };
					}),
				);
			} catch (e) {
				console.error('[steam-upgraded] prêteurs indisponibles', appid, e);
				if (alive) set([]);
			}
		})();
		return () => {
			alive = false;
		};
	}, [appid, version]);
	return copies;
}

/**
 * Choisit la copie utilisée par défaut pour ce jeu (réglage du compte, comme le dialogue natif
 * « Choisir la copie préférée » de Steam). Le client natif passe l'accountId 32 bits du propriétaire
 * (new CSteamID(steamid64).GetAccountID()) et considère le résultat 1 (EResult OK) comme un succès.
 */
export async function setPreferredCopy(appid: number, accountId: number): Promise<boolean> {
	const r = await withTimeout(w.SteamClient.FamilySharing.SetPreferredLender(appid, accountId), 10000);
	return Number(r) === 1;
}

/**
 * Qui joue, et sur quelle copie. Steam ne donne que le verrou de la copie utilisée par ce compte
 * (`strLockedBySteamID` des détails, ce que le client natif affiche en « Utilisé par un membre de votre famille
 * Steam : … ») et le nombre de membres en jeu (`unMembersPlaying`). Le reste se déduit de la présence :
 * un membre qui possède le jeu joue sur sa copie ; s'il ne reste qu'un joueur et qu'une copie libre, c'est celle-là.
 * `onCopy` : accountId du propriétaire de la copie → joueurs ; `elsewhere` : joueurs dont la copie est inconnue ;
 * `unknown` : membres en jeu qu'on ne sait pas nommer (présence masquée, pas en contact).
 */
export type CopyUse = { onCopy: Map<number, number[]>; elsewhere: number[]; unknown: number };

export function copyUse(appid: number, details: any, copies: Copy[] | null): CopyUse {
	const me = myAccountId();
	const onCopy = new Map<number, number[]>();
	const total = Number(details?.unMembersPlaying || 0);
	const used = accountIdOf(String(details?.strOwnerSteamID || '0'));
	const lockedBy = accountIdOf(String(details?.strLockedBySteamID || '0'));
	const place = (owner: number, player: number) => onCopy.set(owner, [...(onCopy.get(owner) || []), player]);

	// membres de la famille (sauf ce compte) en jeu sur cet appid d'après leur présence
	const cache = w.friendStore?.m_FriendsUIFriendStore?.m_mapPlayerCache;
	const ids = new Set<number>([...familyMembers().keys(), ...(copies || []).map((c) => c.accountId)]);
	ids.delete(me);
	let players = [...ids].filter((id) => Number(cache?.get(id)?.m_persona?.m_unGamePlayedAppID) === appid);

	const lockValid = lockedBy > 0 && lockedBy !== me && used > 0;
	if (lockValid) {
		place(used, lockedBy);
		players = players.filter((p) => p !== lockedBy);
	}
	const owners = new Set((copies || []).map((c) => c.accountId));
	const rest: number[] = [];
	for (const p of players) {
		if (owners.has(p)) place(p, p);
		else rest.push(p);
	}
	// copies libres : ni occupées, ni celle de ce compte (libre si Steam ne la dit pas verrouillée)
	const free = (copies || []).filter((c) => !onCopy.has(c.accountId) && c.accountId !== used);
	let elsewhere = rest;
	if (used > 0 && rest.length === 1 && free.length === 1) {
		place(free[0].accountId, rest[0]);
		elsewhere = [];
	}
	const named = [...onCopy.values()].reduce((n, l) => n + l.length, 0) + elsewhere.length;
	return { onCopy, elsewhere, unknown: Math.max(0, total - named) };
}

/** « Alex », « Alex et Camille », « Alex, Camille et Noa ». */
export function namesList(ids: number[]): string {
	const names = ids.map((id) => playerName(id));
	return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
}

// ---------- Collections ----------

export function collectionsOf(appid: number): { id: string; name: string }[] {
	const out: { id: string; name: string }[] = [];
	for (const c of [...(w.collectionStore?.userCollections || [])]) {
		const id = String(c.id);
		if (id.startsWith('type-') || id === 'uncategorized') continue;
		const apps: any[] = c.allApps || [];
		if (apps.some((a) => a?.appid === appid)) out.push({ id, name: c.displayName });
	}
	return out.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

// ---------- Amis ----------

export type Friend = { accountId: number; name: string; avatar?: string; inGame: boolean };

/** Dernière demande des jeux d'un contact : un profil privé répond toujours vide, inutile de redemander à chaque fiche. */
const ownedFetchedAt = new Map<number, number>();
const OWNED_RETRY = 10 * 60000;

/** Amis qui possèdent le jeu (profils visibles) et ceux qui y jouent maintenant. */
export function useFriendsWithGame(appid: number): Friend[] | null {
	const [friends, set] = useState<Friend[] | null>(null);
	useEffect(() => {
		let alive = true;
		set(null);
		if (!appid || isShortcut(appid)) return undefined;
		(async () => {
			try {
				const fs = w.friendStore;
				const ui = fs?.m_FriendsUIFriendStore;
				const ids: number[] = [...(ui?.m_setFriendAccountIDs || [])];
				if (!fs || !ids.length) {
					if (alive) set([]);
					return;
				}
				await Promise.all(
					ids.map(async (id) => {
						if (fs.GetOwnedGames(id)?.size) return;
						if (Date.now() - (ownedFetchedAt.get(id) || 0) < OWNED_RETRY) return;
						ownedFetchedAt.set(id, Date.now());
						try {
							await withTimeout(fs.FetchOwnedGames(id), 8000);
						} catch {}
					}),
				);
				if (!alive) return;
				const out: Friend[] = [];
				for (const id of ids) {
					const persona = ui.m_mapPlayerCache?.get(id)?.m_persona;
					const inGame = Number(persona?.m_unGamePlayedAppID) === appid;
					if (!inGame && !fs.GetOwnedGames(id)?.has(appid)) continue;
					out.push({ accountId: id, name: playerName(id), avatar: avatarUrl(id), inGame });
				}
				out.sort((a, b) => Number(b.inGame) - Number(a.inGame) || a.name.localeCompare(b.name, 'fr'));
				set(out);
			} catch (e) {
				console.error('[steam-upgraded] amis indisponibles', appid, e);
				if (alive) set([]);
			}
		})();
		return () => {
			alive = false;
		};
	}, [appid]);
	return friends;
}

// ---------- Relevés de temps de jeu ----------

/** Un relevé : [jour local depuis l'époque Unix, minutes totales]. */
export type Reading = [number, number];

const MAX_READINGS = 400;

export function localDay(ms = Date.now()): number {
	const d = new Date(ms);
	return Math.floor((ms - d.getTimezoneOffset() * 60000) / 86400000);
}

export function dayToDate(day: number): Date {
	const utc = new Date(day * 86400000);
	return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

function cleanLog(raw: any): Reading[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.filter((r) => Array.isArray(r) && Number.isFinite(r[0]) && Number.isFinite(r[1]))
		.map((r) => [Number(r[0]), Number(r[1])] as Reading)
		.sort((a, b) => a[0] - b[0]);
}

/** Lit les relevés et enregistre celui du jour (au plus un par jour, 400 au maximum). */
export function usePlaytimeLog(appid: number, minutes: number | undefined): Reading[] | null {
	const [log, set] = useState<Reading[] | null>(null);
	useEffect(() => {
		let alive = true;
		set(null);
		if (!appid || minutes === undefined || minutes === null) return undefined;
		const key = `playtimeLog:${appid}`;
		(async () => {
			let readings: Reading[] = [];
			try {
				readings = cleanLog(await pluginConfig.get(key));
			} catch {}
			const today = localDay();
			const last = readings[readings.length - 1];
			let changed = false;
			if (last && last[0] === today) {
				if (last[1] !== minutes) {
					last[1] = minutes;
					changed = true;
				}
			} else {
				readings.push([today, minutes]);
				changed = true;
			}
			if (readings.length > MAX_READINGS) readings = readings.slice(readings.length - MAX_READINGS);
			if (changed) {
				try {
					await pluginConfig.set(key, readings as any);
				} catch (e) {
					console.error('[steam-upgraded] relevé de temps de jeu non enregistré', appid, e);
				}
			}
			if (alive) set(readings);
		})();
		return () => {
			alive = false;
		};
	}, [appid, minutes]);
	return log;
}

export type MonthBar = { key: string; label: string; minutes: number; known: boolean };

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/**
 * Minutes jouées par mois, déduites des écarts entre relevés successifs.
 * L'écart entre deux relevés est compté dans le mois du relevé le plus récent.
 * Renvoie au plus les 12 derniers mois, à partir du mois du premier relevé.
 */
export function monthlyFromLog(log: Reading[]): MonthBar[] {
	if (log.length < 2) return [];
	const per = new Map<string, number>();
	for (let i = 1; i < log.length; i++) {
		const d = dayToDate(log[i][0]);
		const k = `${d.getFullYear()}-${d.getMonth()}`;
		per.set(k, (per.get(k) || 0) + Math.max(0, log[i][1] - log[i - 1][1]));
	}
	const first = dayToDate(log[0][0]);
	const now = new Date();
	const months: MonthBar[] = [];
	let y = now.getFullYear();
	let m = now.getMonth();
	for (let i = 0; i < 12; i++) {
		if (y < first.getFullYear() || (y === first.getFullYear() && m < first.getMonth())) break;
		const k = `${y}-${m}`;
		months.unshift({ key: k, label: MONTHS[m], minutes: per.get(k) || 0, known: true });
		m--;
		if (m < 0) {
			m = 11;
			y--;
		}
	}
	return months;
}

// ---------- Formats ----------

export function formatDate(rt: number): string {
	if (!rt) return '';
	return new Date(rt * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDuration(minutes: number): string {
	if (!minutes) return '0 min';
	if (minutes < 60) return `${minutes} min`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (h >= 10 || !m) return `${h.toLocaleString('fr-FR')} h`;
	return `${h} h ${String(m).padStart(2, '0')}`;
}
