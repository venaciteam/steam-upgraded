// Composant global : applique le thème et place la navigation et le bouton de compte dans la barre de titre de Steam.
import { useEffect, useState } from 'react';
import { applyCss, buildCss, refreshCssSections } from '../core/theme';
import { useSettings, getSettings, onSettings } from '../core/settings';
import { mainWindow } from '../core/steam';
import { AccountButton, NavBar } from './TopNav';
import { DownloadsButton } from './Downloads';
import { FriendsButton } from './Friends';
import { MusicPlayer } from './MusicPlayer';
import { FocusLine } from './FocusLine';

const w = window as any;

/** Feuille d'une fenêtre : Big Picture a son propre thème (OLED par défaut), le reste suit le bureau. */
function cssFor(popup: any): string {
	const s = getSettings();
	return buildCss(popup?.m_strName === 'SP BPM_uid0' ? { ...s, theme: s.bpTheme } : s);
}

/** Applique le thème à toutes les fenêtres Steam ouvertes et à celles qui s'ouvriront. */
export function initThemeEverywhere() {
	const paint = () => {
		for (const p of w.g_PopupManager?.GetPopups?.() || []) {
			try {
				applyCss(p.window?.document, cssFor(p));
			} catch {}
		}
	};
	paint();
	onSettings(paint);
	// Sections de la feuille propres à certains écrans natifs (dialogues, liste réduite) : activées dès que leur cible
	// apparaît dans une fenêtre (sondes par classe, quasi gratuites), voir refreshCssSections dans core/theme.ts.
	setInterval(() => {
		for (const p of w.g_PopupManager?.GetPopups?.() || []) {
			try {
				refreshCssSections(p.window?.document);
			} catch {}
		}
	}, 120);
	w.g_PopupManager?.AddPopupCreatedCallback?.((p: any) => {
		setTimeout(() => {
			try {
				applyCss(p.window?.document, cssFor(p));
			} catch {}
		}, 0);
	});
}

function useIdle(enabled: boolean) {
	useEffect(() => {
		const win = mainWindow();
		const body = win?.document?.body;
		if (!win || !body) return undefined;
		let t: any;
		const wake = () => {
			body.classList.remove('sp-idle');
			clearTimeout(t);
			if (enabled) t = setTimeout(() => body.classList.add('sp-idle'), 5 * 60000);
		};
		wake();
		const evs = ['mousemove', 'keydown', 'mousedown', 'wheel'];
		evs.forEach((e) => win.addEventListener(e, wake, { passive: true }));
		return () => {
			clearTimeout(t);
			body.classList.remove('sp-idle');
			evs.forEach((e) => win.removeEventListener(e, wake));
		};
	}, [enabled]);
}

/** Bouton de compte natif de Steam (« pseudo ▾ ») dans la barre de titre. */
function nativeAccountButton(controls: Element): Element | null {
	for (const child of Array.from(controls.children)) {
		if (child.classList.contains('sp-account-host')) continue;
		const wrapper = child.querySelector(':scope > .MenuWrapper');
		if (wrapper && !wrapper.classList.contains('NotificationButtonContainer')) return child;
	}
	return null;
}

type Hosts = { nav: Element | null; account: Element | null; downloads: Element | null; friends: Element | null };

/** Place (et replace si Steam réaffiche sa barre) nos deux conteneurs dans la barre de titre. */
function placeHosts(): Hosts {
	const doc = mainWindow()?.document;
	const bar = doc?.querySelector('.TopBar > .TitleBar');
	if (!doc || !bar) return { nav: null, account: null, downloads: null, friends: null };

	let nav = bar.querySelector(':scope > .sp-nav-host');
	if (!nav) {
		nav = doc.createElement('div');
		nav.className = 'sp-nav-host';
	}
	const menus = bar.querySelector(':scope > .RootMenuBar');
	if (menus) {
		if (menus.nextElementSibling !== nav) menus.insertAdjacentElement('afterend', nav);
	} else {
		// macOS : pas de menus Steam dans la fenêtre (ils sont dans la barre du système) ; notre navigation suit les feux
		const drag = bar.querySelector(':scope > .DragArea');
		if (drag && drag.previousElementSibling !== nav) drag.insertAdjacentElement('beforebegin', nav);
	}

	const controls = bar.querySelector(':scope > .TitleBarControls');
	let account = controls?.querySelector(':scope > .sp-account-host') || null;
	if (controls) {
		const native = nativeAccountButton(controls);
		if (!account) {
			account = doc.createElement('div');
			account.className = 'sp-account-host';
		}
		if (native) {
			native.classList.add('sp-native-account');
			if (native.previousElementSibling !== account) native.insertAdjacentElement('beforebegin', account);
		} else if (!account.parentElement) controls.appendChild(account);
	}
	// Téléchargements : en tête des contrôles, avant la pilule Actu
	let downloads = controls?.querySelector(':scope > .sp-dl-host') || null;
	if (controls) {
		if (!downloads) {
			downloads = doc.createElement('div');
			downloads.className = 'sp-dl-host';
		}
		if (controls.firstElementChild !== downloads) controls.insertAdjacentElement('afterbegin', downloads);
	}
	// Contacts et chat : au bout de la pilule Actu, juste après les notifications
	let friends = controls?.querySelector(':scope > .sp-friends-host') || null;
	const notif = controls ? Array.from(controls.children).find((c) => c.querySelector('.NotificationButtonContainer')) : null;
	if (controls && notif) {
		if (!friends) {
			friends = doc.createElement('div');
			friends.className = 'sp-friends-host';
		}
		if (notif.nextElementSibling !== friends) notif.insertAdjacentElement('afterend', friends);
	}
	return { nav, account, downloads, friends };
}

export function Shell() {
	const s = useSettings();
	const [hosts, setHosts] = useState<Hosts>({ nav: null, account: null, downloads: null, friends: null });

	useIdle(s.theme === 'oled' && s.antiBurn);

	useEffect(() => {
		let stop = false;
		let observer: MutationObserver | null = null;
		const sync = (): Hosts | null => {
			if (stop) return null;
			const h = placeHosts();
			setHosts((cur) => (cur.nav === h.nav && cur.account === h.account && cur.downloads === h.downloads && cur.friends === h.friends ? cur : h));
			return h;
		};
		const start = () => {
			if (stop) return;
			const h = sync();
			const bar = mainWindow()?.document?.querySelector('.TopBar');
			if (!h?.nav || !bar) {
				setTimeout(start, 500);
				return;
			}
			// Steam peut réafficher sa barre : on remet nos éléments en place si besoin
			observer = new (mainWindow() as any).MutationObserver(() => {
				const doc = mainWindow()?.document;
				const ok =
					doc?.querySelector('.TopBar > .TitleBar > .sp-nav-host') &&
					doc?.querySelector('.TitleBarControls > .sp-account-host') &&
					doc?.querySelector('.TitleBarControls')?.firstElementChild?.classList.contains('sp-dl-host') &&
					doc?.querySelector('.TitleBarControls > .sp-friends-host');
				if (!ok) sync();
			});
			observer!.observe(bar, { childList: true, subtree: true });
		};
		start();
		return () => {
			stop = true;
			observer?.disconnect();
		};
	}, []);

	const portal = w.SP_REACTDOM.createPortal;
	return (
		<>
			{hosts.nav && portal(<NavBar />, hosts.nav)}
			{hosts.account && portal(<AccountButton />, hosts.account)}
			{hosts.downloads && portal(<DownloadsButton />, hosts.downloads)}
			{hosts.friends && portal(<FriendsButton />, hosts.friends)}
			{hosts.nav && portal(<MusicPlayer body={hosts.nav.ownerDocument.body} />, hosts.nav.ownerDocument.body)}
			{hosts.nav && portal(<FocusLine win={hosts.nav.ownerDocument.defaultView} />, hosts.nav.ownerDocument.body)}
		</>
	);
}
