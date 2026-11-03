// Paramètres natifs de Steam intégrés à notre page Paramètres.
// On réutilise les composants de Steam (mêmes réglages, même comportement) et on les habille (theme.ts, .sp-steamset).
// L'ouverture de la fenêtre native (menu Steam › Paramètres, steam://settings, boutons « Paramètres » de Steam)
// est interceptée pour ouvrir notre page sur la bonne section.
import { useEffect, useRef, useState } from 'react';
import { findModuleExport } from 'millennium';
import { mainWindow, navigate, ROUTES } from '../core/steam';

const w = window as any;

type Mods = { Dialog: any; usePages: () => any[]; store: any; routes: any };
let mods: Mods | null | undefined;

const src = (e: any) => {
	try {
		return Function.prototype.toString.call(e);
	} catch {
		return '';
	}
};

/** Pièces de Steam utilisées (null si une mise à jour de Steam les a changées : on garde alors la fenêtre native). */
export function steamSettingsModules(): Mods | null {
	if (mods !== undefined) return mods;
	try {
		const Dialog = findModuleExport((e: any) => typeof e === 'function' && ((s) => s.includes('initialRoute') && s.includes('hideTopBar') && s.includes('fnSetNavigateToPage'))(src(e)));
		const usePages = findModuleExport((e: any) => typeof e === 'function' && ((s) => s.includes('#Settings_Page_Account') && s.includes('#Settings_Page_InGame') && s.length < 40000)(src(e)));
		const store = findModuleExport((e: any) => e && typeof e === 'object' && typeof e.SetVisibleAndNavigate === 'function' && 'sTargetPage' in e);
		const routes = findModuleExport((e: any) => e && typeof e === 'object' && e.Settings && typeof e.Settings.Account === 'function' && e.AppProperties);
		mods = Dialog && usePages && store && routes ? { Dialog, usePages, store, routes } : null;
	} catch (err) {
		console.error('[steam-upgraded] paramètres de Steam introuvables', err);
		mods = null;
	}
	return mods;
}

export type SteamPage = { title: string; route: string } | 'separator';

/** Pages natives visibles, dans l'ordre de Steam (hook de Steam : à appeler à chaque rendu). */
export function useSteamPages(): SteamPage[] {
	const m = steamSettingsModules();
	const pages: any[] = m ? m.usePages() || [] : [];
	const out: SteamPage[] = [];
	for (const p of pages) {
		if (p === 'separator') {
			if (out.length && out[out.length - 1] !== 'separator') out.push('separator');
		} else if (p && p.visible !== false && p.route && p.title) out.push({ title: String(p.title), route: String(p.route) });
	}
	if (out[out.length - 1] === 'separator') out.pop();
	return out;
}

// Page native demandée de l'extérieur (fenêtre native interceptée), lue par la page Paramètres
let requested: string | null = null;
const listeners = new Set<(r: string) => void>();

export function takeRequestedSteamPage(): string | null {
	const r = requested;
	requested = null;
	return r;
}

export function onSteamPageRequested(fn: (r: string) => void): () => void {
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
}

/** Ouvre notre page Paramètres sur une page native (clé de Steam : 'Downloads', 'Account'…). */
export function openSteamSettings(key = 'Account') {
	const m = steamSettingsModules();
	let route = '';
	try {
		route = m?.routes.Settings[key]?.() || '';
	} catch {}
	if (m) requested = route || m.routes.Settings.Account();
	if (requested) listeners.forEach((fn) => fn(requested!));
	navigate(ROUTES.settings);
}

let uiMode = 7;

/** Remplace la fenêtre native des Paramètres par notre page (mode bureau seulement). */
export function initSteamSettingsRedirect() {
	const m = steamSettingsModules();
	if (!m) return;
	w.SteamClient?.UI?.GetUIMode?.().then((v: number) => (uiMode = v)).catch(() => {});
	w.SteamClient?.UI?.RegisterForUIModeChanged?.((v: number) => (uiMode = v));
	const sym = Object.getOwnPropertySymbols(m.store).find((s) => m.store[s]?.values_ instanceof Map);
	const visible = sym ? m.store[sym].values_.get('m_bVisible') : null;
	if (!visible?.intercept_) return;
	// mobx : on annule le passage à « visible » avant que la fenêtre soit créée
	visible.intercept_((change: any) => {
		if (!change.newValue || uiMode !== 7) return change;
		// la page cible est enregistrée juste après la visibilité
		setTimeout(() => {
			openSteamSettings(m.store.sTargetPage || 'Account');
			try {
				(mainWindow() as any)?.SteamClient?.Window?.BringToFront?.();
			} catch {}
		}, 0);
		return null;
	});
}

/** Contenu d'une page native, rendu par le composant de Steam (sa liste de pages est masquée : c'est notre colonne qui navigue). */
export function SteamSettingsPanel({ route }: { route: string }) {
	const m = steamSettingsModules();
	const nav = useRef<((r: string) => void) | null>(null);
	const [mounted, setMounted] = useState(route);
	const shown = useRef(route);
	useEffect(() => {
		if (route === shown.current) return;
		shown.current = route;
		if (nav.current) nav.current(route);
		else setMounted(route);
	}, [route]);
	if (!m) return null;
	const Dialog = m.Dialog;
	return (
		<div className="sp-steamset">
			<Dialog key={mounted} initialRoute={mounted} hideTopBar closeModal={() => {}} fnSetNavigateToPage={(fn: any) => (nav.current = fn)} />
		</div>
	);
}
