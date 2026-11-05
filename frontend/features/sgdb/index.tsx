// Fonctionnalité SteamGridDB.
// Contrat : openArtworkDialog(app) ouvre la fenêtre « Personnaliser les visuels » pour ce jeu ;
// resetArtwork(app) restaure les visuels d'origine.
import { mainWindow, appById } from '../../core/steam';
import { notifyArtChanged } from '../../core/art';
import { padNavigate } from '../../core/padNav';
import { ArtworkDialog } from './ArtworkDialog';
import { Provider, realProvider, SLOTS } from './api';

const w = window as any;

let current: { root: any; host: HTMLElement; stopPad?: () => void } | null = null;

function closeDialog() {
	if (!current) return;
	const { root, host, stopPad } = current;
	current = null;
	stopPad?.();
	try {
		root.unmount();
	} catch (e) {
		console.error('[steam-upgraded] fermeture de la fenêtre des visuels', e);
	}
	host.remove();
}

function resolveApp(app: any): any {
	if (app == null) return null;
	if (typeof app === 'number' || typeof app === 'string') return appById(Number(app)) || { appid: Number(app) };
	return app;
}

function mount(app: any, provider: Provider, targetDoc?: Document) {
	const target = resolveApp(app);
	if (!target?.appid) {
		console.error('[steam-upgraded] openArtworkDialog : jeu invalide', app);
		return;
	}
	const doc = targetDoc || mainWindow()?.document;
	const ReactDOM = w.SP_REACTDOM;
	if (!doc?.body || !ReactDOM?.createRoot) {
		console.error('[steam-upgraded] openArtworkDialog : fenêtre principale ou ReactDOM indisponible');
		return;
	}
	closeDialog();
	const host = doc.createElement('div');
	host.id = 'sp-sgdb-dialog';
	doc.body.appendChild(host);
	const root = ReactDOM.createRoot(host);
	current = { root, host };
	root.render(<ArtworkDialog app={target} provider={provider} onClose={closeDialog} />);
	// Dans Big Picture, la fenêtre se pilote aussi à la manette
	if (doc.body.classList.contains('GamepadUIPopupWindowBody')) current.stopPad = padNavigate(host, closeDialog);
}

/** Ouvre la fenêtre « Personnaliser les visuels » pour un jeu (objet app ou appid).
 * `doc` : document où l'afficher (par défaut la fenêtre du bureau ; Big Picture passe le sien). */
export function openArtworkDialog(app: any, doc?: Document) {
	mount(app, realProvider, doc);
}

/** Supprime tous les visuels personnalisés du jeu (jaquette, bannière, logo, capsule large, icône) et la position du logo. */
export async function resetArtwork(app: any) {
	const target = resolveApp(app);
	if (!target?.appid) return;
	const apps = w.SteamClient.Apps;
	for (const s of SLOTS) {
		try {
			await apps.ClearCustomArtworkForApp(target.appid, s.asset);
		} catch (e) {
			console.error('[steam-upgraded] restauration impossible', s.label, e);
		}
	}
	try {
		await apps.ClearCustomLogoPositionForApp?.(target.appid);
	} catch (e) {
		console.error('[steam-upgraded] restauration de la position du logo impossible', e);
	}
	notifyArtChanged();
}
