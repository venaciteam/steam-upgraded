// Cadre commun des écrans Big Picture : mise à l'échelle (écrans dessinés en 1920 px de large), en-tête
// (sections LB/RB, téléchargement, compte, heure), boutons globaux (LB/RB, ≡ menu rapide, B retour)
// et texte d'information à gauche du pied de page de Steam, qui reste celui d'origine (bons glyphes de manette).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Focusable, GamepadButton } from 'millennium';
import { useSettings } from '../core/settings';
import { previousBpPath } from '../core/history';
import { ACCENTS } from '../core/theme';
import { avatarUrl, bpNavigate, bpRouter, myAccountId, PRESENCE, presenceState, ROUTES, selfPersona } from '../core/steam';
import { readState } from '../shell/Downloads';
import { BP_CSS } from './styles';
import { Glyph, GLYPH } from './Glyph';
import { NowPlayingPill } from './music';

export const DESIGN_WIDTH = 1920;

export type Tab = 'home' | 'library' | 'store' | 'friends';

export const TABS: { id: Tab; label: string; open: () => void }[] = [
	{ id: 'home', label: 'Accueil', open: () => bpNavigate(ROUTES.bpHome) },
	{ id: 'library', label: 'Bibliothèque', open: () => bpNavigate(ROUTES.bpLibrary) },
	{ id: 'store', label: 'Magasin', open: () => bpNavigate(ROUTES.bpStore) },
	// Contacts et chat : notre écran plein (Contacts.tsx), à la place de l'onglet Amis de l'accès rapide
	{ id: 'friends', label: 'Contacts', open: () => bpNavigate(ROUTES.bpContacts) },
];

/** LB (-1) / RB (+1) : section voisine de `tab` dans l'en-tête. */
export function switchTab(tab: Tab | undefined, step: number) {
	const i = TABS.findIndex((t) => t.id === tab);
	if (i >= 0) TABS[i + step]?.open();
}

export function openQuickMenu() {
	bpNavigate(ROUTES.bpMenu);
}

/** B : revient à l'écran Big Picture précédent (notre fil, voir core/history.ts), sinon à l'accueil
 * (le retour natif de Steam peut remonter au-delà du premier écran et relancer Big Picture). */
export function goBackBp() {
	bpNavigate(previousBpPath() || ROUTES.bpHome);
}

/** Menu Steam de Big Picture (celui de la touche Steam / PS). Sert de B sur l'accueil : le retour natif de Steam
 * y remontait au-delà du premier écran et relançait tout Big Picture. */
export function openSteamMenu() {
	bpRouter()?.MenuStore?.OpenMainMenu?.();
}

/** Masque l'en-tête natif de Big Picture tant que l'écran est affiché (nous dessinons le nôtre). */
export function useHideNativeHeader() {
	useEffect(() => {
		const header = bpRouter()?.m_HeaderStore;
		try {
			header?.IncrementHideHeader?.();
		} catch {}
		return () => {
			try {
				header?.DecrementHideHeader?.();
			} catch {}
		};
	}, []);
}

type Box = { zoom: number; height: number; footer: number };

/** Dernière mesure : la taille de l'écran ne change pas d'un écran à l'autre. */
let lastBox: Box | null = null;

/** Échelle et hauteur (en pixels de référence, sur 1920 px de large) d'après la place réellement disponible. */
function useDesignBox(ref: { current: HTMLElement | null }): Box {
	const [box, setBox] = useState<Box>(() => lastBox || { zoom: 2 / 3, height: 1200, footer: 76 });
	useLayoutEffect(() => {
		const el = ref.current;
		const win = el?.ownerDocument?.defaultView as any;
		if (!el || !win) return undefined;
		const measure = () => {
			const zoom = (el.clientWidth || win.innerWidth) / DESIGN_WIDTH;
			if (!zoom) return;
			const foot = el.ownerDocument.querySelector('.BasicFooter') as HTMLElement | null;
			const footer = Math.round((foot?.getBoundingClientRect().height || 50) / zoom);
			const height = Math.round((el.clientHeight || win.innerHeight) / zoom);
			lastBox = { zoom, height, footer };
			setBox((b) => (b.zoom === zoom && b.height === height && b.footer === footer ? b : { zoom, height, footer }));
		};
		// Déjà mesuré sur un écran précédent : pas de mesure au montage (elle forcerait la mise en page de tout l'écran
		// neuf, ≈ 50 ms pour la Bibliothèque) ; le ResizeObserver, appelé après la mise en page, corrige si besoin
		if (!lastBox) measure();
		const ro = win.ResizeObserver ? new win.ResizeObserver(measure) : null;
		ro?.observe(el);
		const t = setTimeout(measure, 600);
		return () => {
			ro?.disconnect();
			clearTimeout(t);
		};
	}, []);
	return box;
}

/**
 * Défilement qui suit le focus, à la place de celui de Steam (branché sur le cadre par fnScrollIntoViewHandler).
 * Celui de Steam ignorait son pied de page posé par-dessus l'écran et l'agrandissement de l'élément focalisé :
 * il fallait une seconde correction, d'où un mouvement en deux temps. Ici, un seul défilement fluide par
 * conteneur, calculé d'emblée. `data-reveal-extra` (pixels de référence) : ce qui dépasse de l'élément une fois
 * focalisé (infos d'une tuile de la bibliothèque). `data-reveal-block` : grand bloc (bannière) montré en entier
 * quand un de ses petits boutons prend le focus, au lieu du seul bouton.
 */
function revealFocused(el: HTMLElement | null | undefined) {
	const root = el?.closest('.spbp') as HTMLElement | null;
	if (!el || !root) return;
	const win = el.ownerDocument.defaultView as any;
	const foot = el.ownerDocument.querySelector('.BasicFooter')?.getBoundingClientRect();
	const block = el.closest('[data-reveal-block]') as HTMLElement | null;
	for (let p = el.parentElement; p && root.contains(p); p = p.parentElement) {
		const cs = win.getComputedStyle(p);
		const canY = /auto|scroll/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 1;
		const canX = /auto|scroll/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 1;
		if (!canX && !canY) continue;
		const b = p.getBoundingClientRect();
		// le cadre est mis à l'échelle (zoom) : pixels d'écran par pixel de défilement
		const scale = b.width / (p.clientWidth || b.width) || 1;
		const r = el.getBoundingClientRect();
		// agrandissement au focus (≈ 8 %, contour et halo) et ce que l'élément déclare en plus
		const grow = r.height * 0.08 + (Number(el.dataset.revealExtra) || 0) * scale;
		const m = 40 * scale;
		let dx = 0;
		let dy = 0;
		if (canY) {
			const top = b.top + m;
			const bottom = (p.classList.contains('spbp-body') && foot ? Math.min(b.bottom, foot.top) : b.bottom) - m;
			// première rangée d'une section : on montre aussi son titre, s'il tient avec elle
			const head = el.closest('section')?.querySelector('h2')?.getBoundingClientRect();
			const withHead = head && head.top < r.top && r.top - head.top < (bottom - top) * 0.3 && r.bottom + grow - head.top <= bottom - top;
			const k = block && p.contains(block) ? block.getBoundingClientRect() : null;
			// bannière : tout en haut de la page si elle tient dans le premier écran, sinon tout le bloc (ou son haut)
			const firstScreen = k && k.bottom - b.top + p.scrollTop * scale <= bottom - b.top;
			if (k && firstScreen) dy = -p.scrollTop * scale;
			else if (k) dy = k.top < top || k.bottom - k.top > bottom - top ? k.top - top : Math.max(0, k.bottom - bottom);
			else if (withHead && head!.top < top) dy = head!.top - top;
			else if (r.top < top || r.bottom + grow - r.top > bottom - top) dy = r.top - top;
			else if (r.bottom + grow > bottom) dy = r.bottom + grow - bottom;
		}
		if (canX) {
			const mx = 64 * scale;
			if (r.left < b.left + mx) dx = r.left - (b.left + mx);
			else if (r.right > b.right - mx) dx = r.right - (b.right - mx);
		}
		if (dx || dy) p.scrollBy({ left: dx / scale, top: dy / scale, behavior: 'smooth' });
	}
}

/** Branché sur le Focusable racine (scrollIntoViewWhenChildFocused="force") : Steam nous laisse tout le défilement. */
function onScrollIntoView(node: any) {
	revealFocused(node?.Element || node?.m_element);
	return true;
}

/** Conteneur placé dans le pied de page natif de Big Picture, pour y afficher notre texte d'information. */
function useFooterHost(enabled: boolean, ref: { current: HTMLElement | null }): HTMLElement | null {
	const [host, setHost] = useState<HTMLElement | null>(null);
	useEffect(() => {
		if (!enabled) return undefined;
		const doc = ref.current?.ownerDocument;
		if (!doc) return undefined;
		const el = doc.createElement('div');
		el.className = 'spbp-footinfo';
		let stop = false;
		const place = () => {
			if (stop) return;
			const foot = doc.querySelector('.BasicFooter');
			if (foot && el.parentElement !== foot) foot.appendChild(el);
			if (!el.parentElement) setTimeout(place, 500);
			else setHost(el);
		};
		place();
		// Steam peut redessiner son pied de page : on vérifie de temps en temps que le texte y est encore
		const iv = setInterval(place, 2000);
		return () => {
			stop = true;
			clearInterval(iv);
			el.remove();
			setHost(null);
		};
	}, [enabled]);
	return host;
}

export function useClock(): string {
	const fmt = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
	const [t, set] = useState(fmt);
	useEffect(() => {
		const id = setInterval(() => set(fmt()), 15000);
		return () => clearInterval(id);
	}, []);
	return t;
}

export function useDownload() {
	const [st, set] = useState(readState);
	useEffect(() => {
		const id = setInterval(() => set(readState()), 1000);
		return () => clearInterval(id);
	}, []);
	return st;
}

export function usePresence() {
	const [state, set] = useState(presenceState);
	useEffect(() => {
		const id = setInterval(() => set(presenceState()), 2000);
		return () => clearInterval(id);
	}, []);
	return PRESENCE.find((p) => p.state === state) || PRESENCE[0];
}

export function SelfAvatar({ size, ring }: { size: number; ring?: string }) {
	const me = selfPersona();
	const presence = usePresence();
	const [broken, setBroken] = useState(false);
	return (
		<span className="spbp-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} aria-hidden="true">
			{me.avatar && !broken ? <img src={me.avatar} alt="" onError={() => setBroken(true)} /> : (me.name || '?').charAt(0).toUpperCase()}
			<i style={{ background: presence.color, borderColor: ring || 'var(--sp-surface2)', width: Math.round(size / 3), height: Math.round(size / 3) }} />
		</span>
	);
}

/** Photo de profil d'une personne de la famille, entourée de sa couleur ; la pastille de couleur seule en secours
 * (pas de photo, ou photo qui ne charge pas). `accountId` absent : la pastille. */
export function MemberAvatar({ accountId, color, size, style }: { accountId?: number; color: string; size: number; style?: any }) {
	const [broken, setBroken] = useState(false);
	const src = accountId ? (accountId === myAccountId() ? selfPersona().avatar : avatarUrl(accountId)) : undefined;
	if (src && !broken)
		return (
			<img
				src={src}
				alt=""
				className="spbp-dot"
				onError={() => setBroken(true)}
				style={{ width: size, height: size, objectFit: 'cover', boxShadow: `0 0 0 ${Math.max(2, Math.round(size / 16))}px ${color}`, ...style }}
			/>
		);
	return <span className="spbp-dot" aria-hidden="true" style={{ width: size, height: size, background: color, ...style }} />;
}

export function Header({ tab }: { tab: Tab }) {
	const clock = useClock();
	const dl = useDownload();
	const presence = usePresence();
	const me = selfPersona();
	return (
		<header className="spbp-header">
			<div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
				<span className="spbp-bumper" aria-hidden="true">
					<Glyph button={GLYPH.LB} size={36} fallback="LB" />
				</span>
				<nav aria-label="Sections" className="spbp-tabs">
					{TABS.map((t) => (
						<button key={t.id} type="button" className="spbp-tab" aria-current={t.id === tab ? 'page' : undefined} onClick={t.open}>
							{t.label}
						</button>
					))}
				</nav>
				<span className="spbp-bumper" aria-hidden="true">
					<Glyph button={GLYPH.RB} size={36} fallback="RB" />
				</span>
			</div>
			<span style={{ flex: 1 }} />
			{dl.active && (
				<span className="spbp-chip" role="status" aria-label={`Téléchargement : ${dl.name}, ${dl.paused ? 'en pause' : `${dl.pct} %`}`}>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
						<path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
					</svg>
					<span style={{ color: 'var(--sp-text)' }}>{dl.paused ? 'En pause' : `${dl.pct} %`}</span>
				</span>
			)}
			<NowPlayingPill />
			<span className="spbp-account">
				<SelfAvatar size={48} />
				<span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
					<span style={{ fontWeight: 800, fontSize: 20 }}>{me.name}</span>
					<span style={{ fontSize: 16, color: 'var(--sp-muted)' }}>{presence.label}</span>
				</span>
			</span>
			<span className="spbp-clock">{clock}</span>
		</header>
	);
}

type FrameProps = {
	tab?: Tab;
	/** Texte affiché à gauche du pied de page de Steam. */
	info?: ReactNode;
	/** B : retour (sur l'accueil, menu Steam : voir openSteamMenu). */
	onBack?: () => void;
	/** Aide affichée pour B dans le pied de page (« Retour » par défaut). */
	backLabel?: string;
	header?: boolean;
	/** Action de l'écran sur le bouton OPTIONS (Y) : rechercher, trier… */
	options?: { label: string; run: () => void };
	/** ≡ : ouvre le menu rapide (le menu rapide lui-même s'en sert pour se refermer). */
	onMenu?: () => void;
	/** Action de l'écran sur le bouton SECONDARY (X), quand elle ne dépend pas de l'élément focalisé. */
	secondary?: { label: string; run: () => void };
	children: ReactNode;
};

export function BpFrame({ tab, info, onBack, backLabel = 'Retour', header = true, options, secondary, onMenu = openQuickMenu, children }: FrameProps) {
	const s = useSettings();
	const ref = useRef<HTMLDivElement>(null);
	const box = useDesignBox(ref);
	useHideNativeHeader();
	const footHost = useFooterHost(!!info, ref);

	const oled = s.bpTheme === 'oled';
	const accent = (ACCENTS[s.accent] || ACCENTS.bleu).hex;
	const vars: Record<string, string> = {
		'--spbp-glow': oled ? `0 0 40px ${accent}77` : '0 12px 30px rgba(0,0,0,.45)',
		'--spbp-glow-strong': oled ? `0 0 46px ${accent}66` : '0 22px 50px rgba(0,0,0,.55)',
		// halo à l'intérieur de l'élément, pour les listes serrées dans une carte
		'--spbp-glow-in': oled ? `inset 0 0 22px ${accent}55` : 'none',
		'--spbp-card': oled ? '#07080a' : 'var(--sp-surface2)',
		'--spbp-footer': `${box.footer}px`,
		// hauteur visible en pixels de référence (un écran 21:9 n'en montre qu'environ 800)
		'--spbp-height': `${box.height}px`,
	};

	const onButtonDown = (e: any) => {
		const b = e?.detail?.button;
		if (b === GamepadButton.BUMPER_LEFT || b === GamepadButton.BUMPER_RIGHT) switchTab(tab, b === GamepadButton.BUMPER_LEFT ? -1 : 1);
	};

	return (
		<div ref={ref} className="sp-root spbp-host">
			<style>{BP_CSS}</style>
			<Focusable
				className="spbp"
				style={{ zoom: box.zoom, height: box.height, ...(vars as any) }}
				onButtonDown={onButtonDown}
				{...({ scrollIntoViewWhenChildFocused: 'force', fnScrollIntoViewHandler: onScrollIntoView } as any)}
				onMenuButton={onMenu}
				onMenuActionDescription={onMenu === openQuickMenu ? 'Menu rapide' : 'Fermer'}
				onCancelButton={onBack}
				onCancelActionDescription={onBack ? backLabel : undefined}
				onOptionsButton={options?.run}
				onOptionsActionDescription={options?.label}
				onSecondaryButton={secondary?.run}
				onSecondaryActionDescription={secondary?.label}
			>
				{header && tab && <Header tab={tab} />}
				<div className="spbp-body" style={{ paddingBottom: box.footer + 24 }}>
					{children}
				</div>
			</Focusable>
			{footHost && info && (window as any).SP_REACTDOM.createPortal(info, footHost)}
		</div>
	);
}
