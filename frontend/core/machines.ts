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

function installHere(app: any) {
	if (String(app?.selected_clientid ?? LOCAL_ID) !== LOCAL_ID) selectMachine(app.appid, LOCAL_ID);
	w.SteamClient.Installs.OpenInstallWizard([app.appid]);
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
			: { kind: 'install', label: 'Installer', run: () => w.SteamClient.Installs.OpenInstallWizard([app.appid]) };
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
		.map((o) => ({ kind: 'remote-install' as const, label: `Installer sur ${o.name}`, machine: o, run: () => w.SteamClient.Installs.OpenInstallWizard([app.appid], o.id) }));
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
