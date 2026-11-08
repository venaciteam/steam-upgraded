// Big Picture › Magasin : boutons Liste de souhaits et Panier (à droite du bandeau du Magasin, en tête de leurs écrans).
import { ReactNode } from 'react';
import { DialogButton, Focusable } from 'millennium';
import { int, loadWishlist, mySteamId, useAsync } from '../pages/store/data';
import { useCart } from '../pages/store/cart';
import { IconCart, IconHeart } from '../pages/store/ui';
import { bpNavigate, ROUTES } from '../core/steam';

/** Recherche (jeux du magasin, de la bibliothèque, contacts) : l'écran Recherche de Big Picture. */
export function BpStoreSearchLink() {
	return (
		<DialogButton className="spbp-storelink" noFocusRing onClick={() => bpNavigate(ROUTES.bpSearch)} onOKActionDescription="Rechercher">
			<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
				<circle cx="11" cy="11" r="6.5" />
				<path d="M20 20l-4.2-4.2" />
			</svg>
			<span style={{ flex: 1 }}>Rechercher</span>
		</DialogButton>
	);
}

export function BpStoreLink({ to, autoFocus }: { to: 'wishlist' | 'cart'; autoFocus?: boolean }) {
	const [wl] = useAsync((force) => loadWishlist(mySteamId(), force), []);
	const { cart } = useCart();
	const n = to === 'wishlist' ? wl.data?.count : cart?.lines.length;
	return (
		<DialogButton
			className="spbp-storelink"
			noFocusRing
			autoFocus={autoFocus}
			onClick={() => bpNavigate(to === 'wishlist' ? ROUTES.bpWishlist : ROUTES.bpCart)}
			onOKActionDescription="Ouvrir"
		>
			{to === 'wishlist' ? <IconHeart size={28} /> : <IconCart size={28} />}
			<span style={{ flex: 1 }}>{to === 'wishlist' ? 'Liste de souhaits' : 'Panier'}</span>
			{n != null && <span className={`spbp-count${to === 'cart' && n > 0 ? ' spbp-count--strong' : ''}`}>{int(n)}</span>}
		</DialogButton>
	);
}

/** En-tête des écrans Liste de souhaits et Panier : retour au Magasin, titre, résumé, l'autre écran. */
export function BpStoreHead({ title, info, other }: { title: string; info?: ReactNode; other: 'wishlist' | 'cart' }) {
	return (
		<Focusable flow-children="row" style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '30px 64px 0' }}>
			<DialogButton className="spbp-pill" noFocusRing onClick={() => bpNavigate(ROUTES.bpStore)} onOKActionDescription="Magasin">
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: 8 }}>
					<path d="m15 6-6 6 6 6" />
				</svg>
				Magasin
			</DialogButton>
			<h1 style={{ margin: '0 0 0 12px', fontSize: 34, fontWeight: 800 }}>{title}</h1>
			{info && <span style={{ marginLeft: 8, fontSize: 19, color: 'var(--sp-muted)' }}>{info}</span>}
			<span style={{ flex: 1 }} />
			<span style={{ display: 'flex', minWidth: 300 }}>
				<BpStoreLink to={other} />
			</span>
		</Focusable>
	);
}
