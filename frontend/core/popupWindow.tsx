// Menus et bulles de la barre du haut dans une vraie petite fenêtre.
// Les pages web de Valve (Communauté, magasin web) sont une vue native que Steam dessine par-dessus toute l'interface :
// un menu posé dans la page passerait dessous. On passe donc par les menus contextuels de Steam forcés en fenêtre
// séparée (comme ses propres menus), habillés par `.sp-popwin` (theme.ts).
import { ReactNode, useEffect, useRef } from 'react';
import { showContextMenu } from 'millennium';

export interface PopupWindow {
	/** Ferme la fenêtre (sans effet si elle est déjà fermée). */
	close(): void;
}

export interface PopupOptions {
	/** Bord de l'ancre sur lequel s'aligner : « right » pour un menu ouvert vers la gauche (bouton à droite de la barre). */
	align?: 'left' | 'right';
	/** Bulle d'information : la fenêtre ne prend pas le focus et ne capte pas les clics ailleurs. */
	tooltip?: boolean;
	/** Appelé une seule fois quand la fenêtre se ferme, quelle qu'en soit la raison (clic ailleurs, Échap, close()). */
	onClose?: () => void;
}

/** Suit la vie du contenu (Steam le démonte quand la fenêtre se ferme) et ferme la fenêtre sur Échap. */
function Lifecycle({ onGone, onEscape, children }: { onGone: () => void; onEscape: () => void; children: ReactNode }) {
	const gone = useRef(onGone);
	gone.current = onGone;
	const esc = useRef(onEscape);
	esc.current = onEscape;
	const box = useRef<HTMLDivElement>(null);
	useEffect(() => {
		// Le focus est dans la fenêtre du menu, sur le cadre de Steam : on écoute tout son document
		const doc = box.current?.ownerDocument;
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && esc.current();
		doc?.addEventListener('keydown', onKey);
		return () => {
			doc?.removeEventListener('keydown', onKey);
			gone.current();
		};
	}, []);
	return (
		<div ref={box} style={{ display: 'contents' }}>
			{children}
		</div>
	);
}

/** Écart entre le bouton et sa fenêtre. */
const GAP = 8;

/**
 * Ancre invisible posée `GAP` px sous la vraie : Steam colle la fenêtre sous son ancre, sans réglage d'écart. Pas de marge
 * transparente dans la fenêtre à la place : sur macOS, ces fenêtres ne sont pas transparentes (zone peinte en noir).
 */
function offsetAnchor(anchor: Element): HTMLElement | null {
	const doc = anchor.ownerDocument;
	if (!doc?.body) return null;
	const r = anchor.getBoundingClientRect();
	const el = doc.createElement('div');
	el.setAttribute('aria-hidden', 'true');
	Object.assign(el.style, {
		position: 'fixed',
		left: `${r.left}px`,
		top: `${r.top + GAP}px`,
		width: `${r.width}px`,
		height: `${r.height}px`,
		visibility: 'hidden',
		pointerEvents: 'none',
	});
	doc.body.appendChild(el);
	return el;
}

/**
 * Ouvre `content` dans une fenêtre sous `anchor` (à `GAP` px). Le contenu est un vrai arbre React (états, effets) ;
 * sa racine porte la classe `sp-popwin` (en plus de `sp-pop`).
 */
export function openPopupWindow(content: ReactNode, anchor: Element, opts: PopupOptions = {}): PopupWindow {
	let open = true;
	let instance: { Hide(): void } | null = null;
	let ghost: HTMLElement | null = null;
	const gone = () => {
		if (!open) return;
		open = false;
		ghost?.remove();
		opts.onClose?.();
	};
	let timer: any = 0;
	const close = () => {
		if (!open) return;
		clearTimeout(timer);
		try {
			instance?.Hide();
		} catch {}
		gone();
	};
	const show = () => {
		if (!open) return;
		try {
			ghost = offsetAnchor(anchor);
			instance = showContextMenu(<Lifecycle onGone={gone} onEscape={close}>{content}</Lifecycle>, ghost || anchor, {
				bForcePopup: true,
				bDisablePopTop: true,
				// Sous l'ancre, aligné sur son bord gauche ou droit (sinon Steam la place à côté)
				bOverlapHorizontal: true,
				bPreferPopLeft: opts.align === 'right',
				// Pas de voile sur la fenêtre principale : il avalait le clic suivant sans refermer le menu. Un menu se
				// ferme quand sa fenêtre perd le focus (clic ailleurs, y compris sur la page web), comme ceux de Steam.
				bDisableMouseOverlay: true,
				...(opts.tooltip ? { bNoFocusWhenShown: true } : {}),
			});
		} catch (e) {
			console.error('[Steam Upgraded] fenêtre de menu', e);
			gone();
		}
	};
	// Clic depuis une autre application : Windows active la fenêtre de Steam pendant que le menu s'ouvre, et le menu,
	// privé de focus, se refermait aussitôt. On attend que la fenêtre de l'ancre ait le focus (au plus 300 ms).
	const doc = anchor.ownerDocument;
	if (opts.tooltip || doc.hasFocus()) show();
	else {
		const t0 = Date.now();
		const wait = () => (doc.hasFocus() || Date.now() - t0 > 300 ? show() : (timer = setTimeout(wait, 20)));
		wait();
	}
	return { close };
}
