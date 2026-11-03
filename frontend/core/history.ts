// Historiques react-router des fenêtres Steam (bureau et Big Picture), et redirections vers nos pages.
// Steam recrée la fenêtre du bureau (avec un nouvel historique) en revenant de Big Picture :
// on surveille donc les historiques en continu et on s'abonne à chaque nouveau.
import { useEffect, useState } from 'react';
import { appById, mainRouter, ourWebOpen, ROUTES } from './steam';
import { getSettings } from './settings';
import { requestCollection } from '../pages/library/data';

const w = window as any;
/** Type d'une bande-son dans Steam (EAppType). */
const MUSIC = 8192;

type Kind = 'desktop' | 'bp';

const hooked = new WeakSet<object>();
const current: Record<Kind, any> = { desktop: null, bp: null };
const pathListeners: Record<Kind, Set<(p: string) => void>> = { desktop: new Set(), bp: new Set() };

function desktopHistory(): any {
	return mainRouter()?.m_history || null;
}

function bpHistory(): any {
	return w.SteamUIStore?.WindowStore?.GamepadUIMainWindowInstance?.m_history || null;
}

/** Page d'accueil du magasin web (avec ou sans paramètres). */
const STORE_FRONT = /^https:\/\/store\.steampowered\.com\/?([?#].*)?$/;

function desktopRedirect(pathname: string, state: any): string | null {
	const s = getSettings();
	if (s.replaceLibrary && (pathname === '/library' || pathname === '/library/home')) return ROUTES.library;
	// « Magasin » du menu de la barre d'état (steam://store) ouvre l'accueil web du magasin : notre Magasin,
	// sauf quand c'est notre bouton « Tout le magasin Steam » qui l'a demandé
	const url = String(state?.strURL || '');
	if (s.replaceLibrary && pathname.startsWith('/browser') && STORE_FRONT.test(url) && !(ourWebOpen.url === url && Date.now() - ourWebOpen.at < 3000)) return ROUTES.store;
	// une collection (jeux masqués, bandes-son, collections de l'utilisateur) : notre bibliothèque sur cette vue
	const coll = pathname.match(/^\/library\/collection\/([^/]+)/);
	if (s.replaceLibrary && coll) {
		requestCollection(decodeURIComponent(coll[1]));
		return ROUTES.library;
	}
	if (s.replaceLibrary && pathname === '/library/downloads') return ROUTES.downloads;
	// Enregistrements et captures : notre page (le détail d'un élément, /media/item/…, reste celui de Steam)
	if (s.replaceLibrary && /^\/media(\/(grid|list))?\/?$/.test(pathname)) return ROUTES.captures;
	const m = pathname.match(/^\/library\/app\/(\d+)/);
	// une bande-son a sa propre page (pochette, pistes, lecteur), y compris depuis l'adresse de notre fiche
	if (s.replaceGamePage && m) return appById(Number(m[1]))?.app_type === MUSIC ? ROUTES.album(m[1]) : ROUTES.app(m[1]);
	const ours = pathname.match(/^\/steamupgraded\/app\/(\d+)/);
	if (ours && appById(Number(ours[1]))?.app_type === MUSIC) return ROUTES.album(ours[1]);
	// Remplacement désactivé : nos boutons (barre du haut, jaquettes) mènent aux pages de Steam
	if (!s.replaceGamePage && ours) return `/library/app/${ours[1]}`;
	if (!s.replaceLibrary) {
		if (pathname === ROUTES.library) return '/library/home';
		if (pathname === ROUTES.downloads) return '/library/downloads';
		if (pathname === ROUTES.captures) return '/media';
	}
	return null;
}

function bpRedirect(pathname: string): string | null {
	if (!getSettings().replaceBigPicture) return null;
	if (pathname === '/library/home' || pathname === '/' || pathname === '/index.html') return ROUTES.bpHome;
	if (pathname === '/library') return ROUTES.bpLibrary;
	// la fiche et ses succès ; les propriétés restent natives (habillées)
	const m = pathname.match(/^\/library\/app\/(\d+)\/?$/);
	// une bande-son ne s'ouvre jamais comme un jeu : sa page d'album, y compris depuis l'adresse de notre fiche
	if (m) return appById(Number(m[1]))?.app_type === MUSIC ? ROUTES.bpAlbum(m[1]) : ROUTES.bpApp(m[1]);
	const ours = pathname.match(/^\/steamupgraded\/bp\/app\/(\d+)/);
	if (ours && appById(Number(ours[1]))?.app_type === MUSIC) return ROUTES.bpAlbum(ours[1]);
	const ach = pathname.match(/^\/library\/app\/(\d+)\/achievements/);
	if (ach) return ROUTES.bpAchievements(ach[1]);
	if (pathname === '/library/downloads') return ROUTES.bpDownloads;
	if (pathname === '/search' || pathname.startsWith('/search/')) return ROUTES.bpSearch;
	if (pathname === '/media' || pathname.startsWith('/media/')) return ROUTES.bpMedia;
	// la route de chat de Big Picture n'a pas d'écran à elle : notre écran Contacts
	if (pathname === '/chat' || pathname.startsWith('/chat/')) return ROUTES.bpContacts;
	return null;
}

/**
 * En Big Picture, Steam recopie le chemin courant dans l'adresse du contexte JS partagé (/routes/<chemin>).
 * Or son serveur interne sert ces adresses comme un fichier (application/octet-stream) : au moindre
 * rechargement du contexte (Steam, Millennium, nos outils), Chromium propose d'enregistrer un fichier
 * « home » et l'interface reste vide. On remet donc l'adresse de démarrage d'origine (index.html et ses
 * paramètres), mémorisée tant qu'elle est encore là.
 */
const START_KEY = 'steamupgraded:contextStartUrl';

function rememberStartUrl() {
	try {
		// adresse avec laquelle le contexte a été chargé, même si Steam l'a changée depuis
		const loaded = String(w.performance?.getEntriesByType?.('navigation')?.[0]?.name || w.location?.href || '');
		if (new URL(loaded).pathname === '/index.html') w.localStorage?.setItem(START_KEY, loaded);
	} catch {}
}

function keepContextUrlLoadable() {
	if (!w.location?.pathname?.startsWith('/routes/')) return;
	let start = '';
	try {
		start = w.localStorage?.getItem(START_KEY) || '';
	} catch {}
	w.history.replaceState(w.history.state, '', start || '/index.html');
}

// Fil des écrans visités en Big Picture. Steam y réécrit sa pile d'historique (un retour arrière
// ramène à l'accueil au lieu de l'écran précédent) : B revient donc à l'écran noté ici.
const bpTrail: string[] = [];

function followBpTrail(pathname: string) {
	if (bpTrail[bpTrail.length - 1] === pathname) return;
	if (bpTrail[bpTrail.length - 2] === pathname) bpTrail.pop();
	else bpTrail.push(pathname);
	if (bpTrail.length > 30) bpTrail.splice(0, bpTrail.length - 30);
}

// Chemin précédent de la fenêtre du bureau (transitions : retour d'une page web de Valve)
const desktopTrail = ['', ''];

/** Chemin affiché avant le chemin courant dans la fenêtre du bureau ('' au départ). */
export function previousDesktopPath(): string {
	return desktopTrail[0];
}

/** Écran Big Picture précédent (null s'il n'y en a pas). */
export function previousBpPath(): string | null {
	return bpTrail.length >= 2 ? bpTrail[bpTrail.length - 2] : null;
}

function attach(kind: Kind, history: any) {
	current[kind] = history;
	if (hooked.has(history)) return;
	hooked.add(history);
	const attachedAt = Date.now();
	const check = (loc: any) => {
		let to: string | null;
		if (kind === 'desktop') {
			// À l'ouverture de la fenêtre, Steam affiche sa page d'accueil web (/browser), parfois après nous :
			// on la remplace pendant les premières secondes de chaque nouvelle fenêtre.
			const opening = Date.now() - attachedAt < 20000 && loc.pathname.startsWith('/browser') && getSettings().replaceLibrary;
			to = opening ? ROUTES.library : desktopRedirect(loc.pathname, loc.state);
		} else to = bpRedirect(loc.pathname);
		if (to && to !== loc.pathname) {
			history.replace(to);
			return;
		}
		if (kind === 'bp') followBpTrail(loc.pathname);
		else if (current.desktop === history && desktopTrail[1] !== loc.pathname) {
			desktopTrail[0] = desktopTrail[1];
			desktopTrail[1] = loc.pathname;
		}
		// Steam met l'adresse du contexte à jour juste après le changement de route (voir keepContextUrlLoadable)
		setTimeout(keepContextUrlLoadable, 50);
		if (current[kind] === history) pathListeners[kind].forEach((fn) => fn(history.location.pathname));
	};
	history.listen((loc: any) => check(loc.location || loc));
	check(history.location);
}

export function initHistory() {
	const scan = () => {
		const d = desktopHistory();
		if (d) attach('desktop', d);
		const b = bpHistory();
		if (b) attach('bp', b);
		keepContextUrlLoadable();
	};
	rememberStartUrl();
	scan();
	setInterval(scan, 1000);
}

export function currentPath(kind: Kind = 'desktop'): string {
	return current[kind]?.location?.pathname || '';
}

export function goBack() {
	const h = current.desktop;
	h?.goBack ? h.goBack() : h?.back?.();
}

export function goForward() {
	const h = current.desktop;
	h?.goForward ? h.goForward() : h?.forward?.();
}

/** Chemin courant de la fenêtre du bureau (ou de Big Picture avec `kind = 'bp'`). */
export function usePath(kind: Kind = 'desktop'): string {
	const [p, set] = useState(currentPath(kind));
	useEffect(() => {
		set(currentPath(kind));
		pathListeners[kind].add(set);
		return () => {
			pathListeners[kind].delete(set);
		};
	}, [kind]);
	return p;
}
