import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { goBack, goForward, usePath } from '../core/history';
import { openPopupWindow, PopupWindow } from '../core/popupWindow';
import { mainWindow, navigate, openSteamWeb, PRESENCE, presenceState, ROUTES, schedulePresenceReturn, selfPersona, setPresence } from '../core/steam';
import { setSetting, useSettings } from '../core/settings';
import { beforeNextFrame } from '../core/transitions';
import { requestUpdatesPage, useUpdateAvailable } from '../features/updates';

const w = window as any;

const Chevron = ({ up }: { up?: boolean }) => (
	<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
		<path d={up ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'} />
	</svg>
);

const Arrow = ({ dir }: { dir: 'left' | 'right' }) => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
		<path d={dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
	</svg>
);

/** Adresse affichée par le navigateur intégré de Steam (route /browser). */
function webUrl(): string {
	// Plusieurs éléments portent ce nom (dont un « URLBarReplacement » vide) : on garde le premier qui contient une adresse
	const bars: Element[] = [...(mainWindow()?.document?.querySelectorAll('[class*="URLBar"], [class*="UrlBar"]') || [])];
	return bars.map((el) => el.textContent || '').find((t) => t.includes('://')) || '';
}

export function NavBar() {
	const path = usePath();
	// Sur une page web, l'adresse s'affiche après le changement de route : on la relit tant qu'on y est
	const onWeb = path.startsWith('/browser');
	const [community, setCommunity] = useState(false);
	useEffect(() => {
		if (!onWeb) {
			setCommunity(false);
			return undefined;
		}
		const read = () => setCommunity(/steamcommunity\.com/.test(webUrl()));
		read();
		const t = setInterval(read, 400);
		return () => clearInterval(t);
	}, [onWeb]);
	// Nouvelle version de Steam Upgraded : pastille discrète sur Paramètres, qui ouvre alors « Mises à jour »
	const update = useUpdateAvailable();
	const items = [
		{ label: 'Bibliothèque', active: /^\/steamupgraded\/(library|app|album|captures)/.test(path) || (path.startsWith('/library') && !path.startsWith('/library/downloads')), go: () => navigate(ROUTES.library) },
		{ label: 'Magasin', active: /^\/steamupgraded\/(store|vente|souhaits|panier)/.test(path), go: () => navigate(ROUTES.store) },
		{ label: 'Communauté', active: onWeb && community, go: () => openSteamWeb('https://steamcommunity.com/') },
		{ label: 'Paramètres', active: path.startsWith('/steamupgraded/settings'), go: () => (update && requestUpdatesPage(), navigate(ROUTES.settings)) },
	];
	const current = items.find((it) => it.active);
	const activeIndex = items.indexOf(current as any);
	const pill = usePillMenu(items.filter((it) => it !== current));
	const navRef = useRef<HTMLElement>(null);
	const indRef = useRef<HTMLSpanElement>(null);
	// Pastille de l'onglet actif : elle glisse d'un onglet à l'autre (placée sans animation la première fois)
	useLayoutEffect(() => {
		const nav = navRef.current;
		const ind = indRef.current;
		if (!nav || !ind) return undefined;
		const place = () => {
			const btn = activeIndex >= 0 ? (nav.children[activeIndex + 1] as HTMLElement | undefined) : undefined;
			if (btn) {
				ind.style.transform = `translateX(${btn.offsetLeft}px)`;
				ind.style.width = `${btn.offsetWidth}px`;
			}
			ind.style.opacity = btn ? '1' : '0';
		};
		// Juste avant l'image suivante, pas pendant le changement de page (mise en page forcée, voir core/transitions.ts)
		const win = nav.ownerDocument.defaultView;
		const stop = beforeNextFrame(win, () => {
			place();
			beforeNextFrame(win, () => nav.classList.add('sp-ind-ready'));
		});
		const ro = win ? new (win as any).ResizeObserver(place) : null;
		ro?.observe(nav);
		return () => {
			stop();
			ro?.disconnect();
		};
	}, [activeIndex]);
	return (
		<div className="sp-topnav">
			<div style={{ display: 'flex', gap: 2 }}>
				<button type="button" className="sp-arrow" aria-label="Page précédente" onClick={goBack}><Arrow dir="left" /></button>
				<button type="button" className="sp-arrow" aria-label="Page suivante" onClick={goForward}><Arrow dir="right" /></button>
			</div>
			<nav aria-label="Sections" ref={navRef}>
				<span className="sp-topnav-ind" ref={indRef} aria-hidden="true" />
				{items.map((it) => (
					<button key={it.label} type="button" aria-current={it.active ? 'page' : undefined} onClick={it.go} title={update && it.label === 'Paramètres' ? 'Une mise à jour de Steam Upgraded est disponible' : undefined}>
						{it.label}
						{update && it.label === 'Paramètres' && <span className="sp-update-dot" aria-label="mise à jour disponible" />}
					</button>
				))}
			</nav>
			{/* Fenêtre étroite : les onglets se replient en une pilule (theme.ts) dont le menu s'ouvre au survol ou au clic */}
			<div className="sp-navpill" onMouseEnter={pill.enter} onMouseLeave={pill.leave}>
				<button type="button" className="sp-navpill-current" aria-haspopup="menu" aria-expanded={pill.open} onClick={pill.click}>
					{current?.label || 'Navigation'}
					<Chevron />
				</button>
			</div>
		</div>
	);
}

type NavItem = { label: string; go: () => void };

/** Délai avant de refermer le menu de la pilule quand la souris la quitte (le temps d'atteindre sa fenêtre). */
const PILL_LEAVE_DELAY = 180;

/**
 * Menu de la pilule de navigation, dans une vraie fenêtre (core/popupWindow.tsx) pour passer au-dessus des pages web.
 * Survol : s'ouvre sans prendre le focus et se referme quand la souris quitte la pilule et le menu.
 * Clic (ou Entrée) : s'ouvre avec le focus et se referme au clic ailleurs.
 */
function usePillMenu(entries: NavItem[]) {
	const [open, setOpen] = useState(false);
	const win = useRef<PopupWindow | null>(null);
	const timer = useRef<any>(0);
	const closedAt = useRef(0);
	const list = useRef(entries);
	list.current = entries;

	useEffect(
		() => () => {
			clearTimeout(timer.current);
			win.current?.close();
		},
		[],
	);

	const cancelClose = () => clearTimeout(timer.current);
	const scheduleClose = () => {
		clearTimeout(timer.current);
		timer.current = setTimeout(() => win.current?.close(), PILL_LEAVE_DELAY);
	};
	const show = (anchor: Element, hover: boolean) => {
		cancelClose();
		if (win.current) return;
		setOpen(true);
		win.current = openPopupWindow(
			<div className="sp-pop sp-popwin sp-navpill-list" role="menu" aria-label="Aller à" onMouseEnter={cancelClose} onMouseLeave={hover ? scheduleClose : undefined}>
				{list.current.map((it) => (
					<button
						key={it.label}
						type="button"
						role="menuitem"
						className="sp-pop-item"
						onClick={() => {
							win.current?.close();
							it.go();
						}}
					>
						{it.label}
					</button>
				))}
			</div>,
			anchor,
			{
				align: 'left',
				tooltip: hover,
				onClose: () => {
					clearTimeout(timer.current);
					win.current = null;
					closedAt.current = Date.now();
					setOpen(false);
				},
			},
		);
	};
	return {
		open,
		enter: (e: { currentTarget: EventTarget }) => show(e.currentTarget as Element, true),
		leave: scheduleClose,
		click: (e: { currentTarget: EventTarget }) => {
			// Déjà ouvert au survol : le clic le laisse ouvert ; juste refermé par ce clic (perte du focus) : on ne le rouvre pas
			if (win.current || Date.now() - closedAt.current < 300) return;
			const el = e.currentTarget as Element;
			show(el.parentElement || el, false);
		},
	};
}

const RETURN_CHOICES = [0, 30, 60, 120, 240];

function steamId64(): string {
	return w.App?.m_CurrentUser?.strSteamID || '';
}

/** Bouton de compte : présence toujours visible + actions du compte (remplace le menu « pseudo ▾ » de Steam). */
export function AccountButton() {
	const [open, setOpen] = useState(false);
	const [state, setState] = useState(presenceState());
	const btn = useRef<HTMLButtonElement>(null);
	const win = useRef<PopupWindow | null>(null);
	const closedAt = useRef(0);
	const me = selfPersona();
	const current = PRESENCE.find((p) => p.state === state) || PRESENCE[0];
	// Après un rechargement, Steam remplit le profil (nom, photo) un peu après : on suit aussi ces deux valeurs
	const [, setPersonaKey] = useState(`${me.name}|${me.avatar || ''}`);

	useEffect(() => {
		const id = setInterval(() => {
			setState(presenceState());
			const p = selfPersona();
			setPersonaKey(`${p.name}|${p.avatar || ''}`);
		}, 1500);
		return () => {
			clearInterval(id);
			win.current?.close();
		};
	}, []);

	// Le menu s'ouvre dans une vraie fenêtre (core/popupWindow.tsx) pour passer au-dessus des pages web de Valve.
	// Clic ailleurs ou Échap : Steam ferme la fenêtre, onClose remet le bouton à jour.
	const toggle = () => {
		if (win.current) {
			win.current.close();
			return;
		}
		// Le clic sur le bouton vient de refermer le menu (sa fenêtre a perdu le focus) : on ne le rouvre pas
		if (Date.now() - closedAt.current < 300 || !btn.current) return;
		setOpen(true);
		win.current = openPopupWindow(<AccountMenu onPresence={setState} close={() => win.current?.close()} />, btn.current, {
			align: 'right',
			onClose: () => {
				win.current = null;
				closedAt.current = Date.now();
				setOpen(false);
			},
		});
	};

	return (
		<>
			<button ref={btn} type="button" className="sp-presence" aria-expanded={open} aria-haspopup="menu" aria-label={`${me.name}, statut : ${current.label}. Ouvrir le menu du compte`} onClick={toggle}>
				<span style={{ position: 'relative', width: 26, height: 26, flex: 'none' }}>
					{me.avatar ? (
						<img src={me.avatar} alt="" style={{ width: 26, height: 26, borderRadius: '50%', display: 'block' }} />
					) : (
						<span className="sp-avatar" style={{ width: 26, height: 26, background: 'var(--sp-accent)', fontSize: 12 }}>{me.name.charAt(0)}</span>
					)}
					<span style={{ position: 'absolute', right: -2, bottom: -2, width: 10, height: 10, boxSizing: 'border-box', borderRadius: '50%', background: current.color, border: '2px solid var(--sp-surface2)' }} />
				</span>
				<span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
					<span style={{ fontWeight: 700, fontSize: 12.5 }}>{me.name}</span>
					<span style={{ fontSize: 11, fontWeight: 600, color: current.color }}>{current.label}</span>
				</span>
				<Chevron up={open} />
			</button>
		</>
	);
}

/** Contenu du menu du compte, rendu dans sa fenêtre. */
function AccountMenu({ onPresence, close }: { onPresence: (state: number) => void; close: () => void }) {
	const [state, setState] = useState(presenceState());
	const [confirmLogout, setConfirmLogout] = useState(false);
	const s = useSettings();
	const me = selfPersona();
	const balance: string = w.App?.m_CurrentUser?.strAccountBalance || '';
	const choose = (st: number) => {
		setPresence(st);
		setState(st);
		onPresence(st);
		schedulePresenceReturn(s.presenceReturnMinutes, st);
	};
	const act = (fn: () => void) => () => {
		close();
		fn();
	};

	return (
		<div className="sp-pop sp-popwin" role="menu" aria-label="Compte et présence" style={{ width: 310 }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px 10px' }}>
				{me.avatar && <img src={me.avatar} alt="" style={{ width: 40, height: 40, borderRadius: '50%' }} />}
				<span style={{ display: 'flex', flexDirection: 'column' }}>
					<span style={{ fontWeight: 800 }}>{me.name}</span>
					{balance && <span className="sp-muted" style={{ fontSize: 12 }}>Portemonnaie : {balance}</span>}
				</span>
			</div>
			<div className="sp-sep" />
			<div className="sp-label" style={{ padding: '8px 10px 6px' }}>Ma présence</div>
			{PRESENCE.map((p) => (
				<button key={p.state} type="button" role="menuitemradio" aria-checked={p.state === state} className="sp-pop-item" onClick={() => choose(p.state)}>
					<span style={{ width: 11, height: 11, borderRadius: '50%', background: p.color, flex: 'none' }} />
					<span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
						<span style={{ fontWeight: 700 }}>{p.label}</span>
						<span className="sp-muted" style={{ fontSize: 12 }}>{p.sub}</span>
					</span>
				</button>
			))}
			<div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', fontSize: 13 }}>
				<span className="sp-muted" style={{ flex: 1 }}>Revenir « En ligne » après</span>
				<select className="sp-input" style={{ height: 32, width: 100 }} value={s.presenceReturnMinutes} onChange={(e) => {
						const m = Number((e.target as HTMLSelectElement).value);
						setSetting('presenceReturnMinutes', m);
						// s'applique aussi à l'absence en cours
						schedulePresenceReturn(m, state);
					}}>
					{(RETURN_CHOICES.includes(s.presenceReturnMinutes) ? RETURN_CHOICES : [...RETURN_CHOICES, s.presenceReturnMinutes].sort((a, b) => a - b)).map((m) => (
						<option key={m} value={m}>{m === 0 ? 'jamais' : m < 60 || m % 60 ? `${m} min` : `${m / 60} h`}</option>
					))}
				</select>
			</div>
			<div className="sp-sep" />
			<button type="button" role="menuitem" className="sp-pop-item" onClick={act(() => openSteamWeb(`https://steamcommunity.com/profiles/${steamId64()}/`))}>Voir mon profil</button>
			<button type="button" role="menuitem" className="sp-pop-item" onClick={act(() => openSteamWeb('https://store.steampowered.com/account/'))}>Détails du compte</button>
			<button type="button" role="menuitem" className="sp-pop-item" onClick={act(() => openSteamWeb('https://store.steampowered.com/account/preferences/'))}>Préférences du magasin</button>
			<button type="button" role="menuitem" className="sp-pop-item" onClick={act(() => openSteamWeb('https://store.steampowered.com/account/history/'))}>Mon portemonnaie</button>
			<div className="sp-sep" />
			<button type="button" role="menuitem" className="sp-pop-item" onClick={act(() => w.SteamClient.User.ChangeUser())}>Changer de compte…</button>
			{confirmLogout ? (
				<button type="button" role="menuitem" className="sp-pop-item" style={{ color: 'var(--sp-busy)', fontWeight: 700 }} onClick={act(() => w.SteamClient.User.SignOutAndRestart())}>
					Confirmer : se déconnecter et redémarrer Steam
				</button>
			) : (
				<button type="button" role="menuitem" className="sp-pop-item" onClick={() => setConfirmLogout(true)}>Se déconnecter du compte…</button>
			)}
		</div>
	);
}
