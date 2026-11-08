// Jouer, installer ou streamer : sur quelle machine ?
// Steam connaît l'état d'un jeu sur chaque ordinateur du compte (per_client_data) : « cette machine » (clientid "0") et les
// autres (Remote Play). Son champ `installed` décrit la machine SÉLECTIONNÉE pour le jeu, qui peut être un autre
// ordinateur : sur un Mac, un jeu installé sur le PC paraissait « installé », et « Jouer » lançait un streaming.
// Ici, l'action principale porte toujours sur l'ordinateur devant soi ; les autres machines sont des choix explicites.

const w = window as any;

export const LOCAL_ID = '0';

export type Machine = {
	id: string;
	name: string;
	local: boolean;
	installed: boolean;
	/** Le jeu existe pour le système de cette machine (Steam : is_available_on_current_platform, os valide). */
	available: boolean;
	displayStatus: number;
};

export type ActionKind = 'play' | 'install' | 'stream' | 'remote-install' | 'unavailable';

export type GameAction = {
	kind: ActionKind;
	label: string;
	/** Machine concernée (absente pour un jeu sans données par machine). */
	machine?: Machine;
	disabled?: boolean;
	run: () => void;
};

/** « ce Mac », « ce PC » ou « cet ordinateur » (Linux), selon le système qui affiche Steam. */
export function hereLabel(): string {
	const p = navigator.platform || '';
	if (/mac/i.test(p)) return 'ce Mac';
	if (/win/i.test(p)) return 'ce PC';
	return 'cet ordinateur';
}

/** « Mac », « Windows » ou « Linux ». */
export function systemName(): string {
	const p = navigator.platform || '';
	if (/mac/i.test(p)) return 'Mac';
	if (/win/i.test(p)) return 'Windows';
	return 'Linux';
}

function toMachine(c: any): Machine {
	const local = String(c?.clientid) === LOCAL_ID;
	return {
		id: String(c?.clientid ?? ''),
		name: local ? hereLabel() : String(c?.client_name || 'un autre ordinateur'),
		local,
		installed: !!c?.installed,
		available: c?.is_available_on_current_platform !== false && !c?.is_invalid_os_type,
		displayStatus: Number(c?.display_status ?? 0),
	};
}

/** Cette machine (null si le jeu n'existe pas pour son système) et les autres machines du compte. */
export function machinesOf(app: any): { here: Machine | null; others: Machine[]; known: boolean } {
	const list: any[] = Array.isArray(app?.per_client_data) ? app.per_client_data : [];
	if (!list.length) return { here: null, others: [], known: false };
	const all = list.map(toMachine);
	const here = all.find((m) => m.local) || null;
	return { here: here && here.available ? here : null, others: all.filter((m) => !m.local), known: true };
}

/**
 * États affichés par Steam (lancement, téléchargement, mise à jour…) sur chaque machine du compte, en une clé courte :
 * elle change dès que le bouton Jouer d'un jeu doit changer.
 */
export function statusKey(app: any): string {
	const list: any[] = Array.isArray(app?.per_client_data) ? app.per_client_data : [];
	let k = String(app?.display_status ?? 0);
	for (const c of list) k += `.${c?.display_status ?? 0}`;
	return k;
}

/** Installé sur l'ordinateur devant soi (pas sur une autre machine du compte). */
export function installedHere(app: any): boolean {
	const m = machinesOf(app);
	if (!m.known) return !!app?.installed;
	return !!m.here?.installed;
}

/** Choisit la machine du jeu dans Steam (celle que visent ensuite « Jouer » et « Installer »). */
function selectMachine(appid: number, id: string) {
	try {
		w.SteamClient?.Apps?.SetStreamingClientForApp?.(appid, id);
	} catch {}
}

function runHere(app: any) {
	if (String(app?.selected_clientid ?? LOCAL_ID) !== LOCAL_ID) selectMachine(app.appid, LOCAL_ID);
	w.SteamClient.Apps.RunGame(String(app.gameid || app.appid), '', -1, 100);
}

/**
 * Assistant d'installation de Steam pour une machine du compte (LOCAL_ID : l'ordinateur devant soi).
 * Steam exige désormais la machine (2e argument) : sans elle, l'appel échoue sans rien afficher (« requires 2 arguments »).
 */
export function openInstallWizard(appids: number[], clientid: string = LOCAL_ID) {
	w.SteamClient.Installs.OpenInstallWizard(appids.map(Number), clientid);
}

function installHere(app: any) {
	if (String(app?.selected_clientid ?? LOCAL_ID) !== LOCAL_ID) selectMachine(app.appid, LOCAL_ID);
	openInstallWizard([app.appid]);
}

/**
 * Action principale et liste des choix d'un jeu.
 * - Principale : jouer ici, sinon installer ici, sinon streamer depuis une machine où il est installé, sinon l'installer
 *   sur une autre machine, sinon indisponible.
 * - Choix : cette machine (jouer, installer ou « non disponible »), chaque machine où le jeu est installé (streaming), puis
 *   chaque machine où il peut l'être (installation à distance).
 *   Une seule entrée = pas de vrai choix : pas de flèche (cas d'un ordinateur seul).
 */
export function gameActions(app: any): { primary: GameAction; choices: GameAction[] } {
	const m = machinesOf(app);
	if (!m.known) {
		// Pas de données par machine (raccourci non Steam, ancienne version de Steam) : comportement d'origine
		const a: GameAction = app?.installed
			? { kind: 'play', label: 'Jouer', run: () => w.SteamClient.Apps.RunGame(String(app.gameid || app.appid), '', -1, 100) }
			: { kind: 'install', label: 'Installer', run: () => openInstallWizard([app.appid]) };
		return { primary: a, choices: [a] };
	}
	const here = hereLabel();
	const hereAction: GameAction = m.here?.installed
		? { kind: 'play', label: `Jouer sur ${here}`, machine: m.here, run: () => runHere(app) }
		: m.here
			? { kind: 'install', label: `Installer sur ${here}`, machine: m.here, run: () => installHere(app) }
			: { kind: 'unavailable', label: `Non disponible sur ${systemName()}`, disabled: true, run: () => {} };
	const streams: GameAction[] = m.others
		.filter((o) => o.installed)
		.map((o) => ({ kind: 'stream' as const, label: `Streamer depuis ${o.name}`, machine: o, run: () => w.SteamClient.Apps.StreamGame(app.appid, o.id, -1) }));
	// Installation sur une autre machine du compte (Steam l'y lance à distance), pour la streamer ensuite
	const remoteInstalls: GameAction[] = m.others
		.filter((o) => !o.installed && o.available)
		.map((o) => ({ kind: 'remote-install' as const, label: `Installer sur ${o.name}`, machine: o, run: () => openInstallWizard([app.appid], o.id) }));
	const choices = [hereAction, ...streams, ...remoteInstalls];
	let primary: GameAction;
	if (hereAction.kind !== 'unavailable') primary = { ...hereAction, label: hereAction.kind === 'play' ? 'Jouer' : 'Installer' };
	else if (streams.length) primary = streams[0];
	else if (remoteInstalls.length) primary = remoteInstalls[0];
	else primary = hereAction;
	return { primary, choices };
}

/** Lance l'action principale (cartes, menus, Big Picture). */
export function runPrimary(app: any) {
	const { primary } = gameActions(app);
	if (!primary.disabled) primary.run();
}

// ---------- Taille du jeu ----------

/** Taille lisible (« 3,4 Go », « 820 Mo »), en unités binaires comme Steam ; vide si inconnue. */
export function sizeLabel(bytes: number): string {
	if (!(bytes > 0)) return '';
	const go = bytes / 1024 ** 3;
	if (go >= 1) return `${go.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Go`;
	const mo = bytes / 1024 ** 2;
	return mo >= 1 ? `${Math.round(mo)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} ko`;
}

/**
 * Taille d'un jeu sur l'ordinateur devant soi : espace occupé s'il est installé (celui qu'affiche Steam), sinon espace
 * nécessaire pour l'installer. Les deux viennent des détails du jeu (`appDetailsStore`), chargés par
 * `RegisterForAppData` ; la vue d'ensemble ne donne que la taille d'un jeu installé (`size_on_disk`).
 * Jeu non installé : `lDiskSpaceRequiredBytes` compte aussi les contenus additionnels possédés, installés avec le jeu ;
 * leur part est dans `lDlcUsageBytes` (`dlc`). Elle peut être énorme (NieR:Automata, novembre 2026 : 366 Go dont 326 de
 * contenus, chiffre réel chez tout le monde), d'où son affichage à part sur la fiche.
 */
export function gameSize(app: any, details?: any): { bytes: number; dlc: number; installed: boolean } {
	const installed = installedHere(app);
	const d = details ?? w.appDetailsStore?.GetAppDetails?.(app?.appid);
	const bytes = installed ? Number(d?.lDiskUsageBytes || app?.size_on_disk || 0) : Number(d?.lDiskSpaceRequiredBytes || 0);
	const dlc = Number(d?.lDlcUsageBytes || 0);
	return { bytes, dlc: dlc > 0 && dlc < bytes ? dlc : 0, installed };
}
