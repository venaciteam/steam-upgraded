// « Enregistrements et captures d'écran » : en mode bureau, Steam ouvre une fenêtre à part (adresses steam://open/screenshots
// et steam://open/media, menu Afficher, notifications de capture). On remplace son gestionnaire par l'ouverture de notre page.
// Les extraits et enregistrements (open/clip, open/recording) restent à Steam.
import { findModuleExport } from 'millennium';
import { mainWindow, navigate, ROUTES } from '../core/steam';

const w = window as any;
const DESKTOP = 7;
const URLS = ['open/screenshots', 'open/media'];

function openCaptures() {
	navigate(ROUTES.captures);
	try {
		(mainWindow() as any)?.SteamClient?.Window?.BringToFront?.();
	} catch {}
}

/** Registre des adresses steam:// de l'interface (un gestionnaire par adresse et par mode). */
function urlRegistry(): any {
	try {
		return findModuleExport((e: any) => e && typeof e === 'object' && typeof e.RegisterForRunSteamURL === 'function' && e.m_mapModeToCallbacks instanceof Map);
	} catch {
		return null;
	}
}

export function initMediaRedirect() {
	const reg = urlRegistry();
	if (!reg) return;
	const apply = () => {
		const callbacks: Map<string, any> | undefined = reg.m_mapModeToCallbacks.get(DESKTOP);
		if (!callbacks) return;
		for (const url of URLS) {
			if (callbacks.get(url) === openCaptures) continue;
			callbacks.set(url, openCaptures);
			if (reg.m_uiMode !== DESKTOP) continue;
			// déjà inscrit chez Steam : on remplace l'inscription
			const key = reg.RegisteredCallbackKey(url, DESKTOP);
			reg.m_mapRegisteredCallbacks.get(key)?.unregister?.();
			reg.m_mapRegisteredCallbacks.set(key, w.SteamClient.URL.RegisterForRunSteamURL(url, openCaptures));
		}
	};
	apply();
	// Steam réinscrit ses gestionnaires en changeant de mode (bureau ↔ Big Picture)
	w.SteamClient?.UI?.RegisterForUIModeChanged?.(() => setTimeout(apply, 500));
	setInterval(apply, 10000);
}
