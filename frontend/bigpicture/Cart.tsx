// Big Picture › Magasin › Panier : articles du panier du compte (pages/store/cart.ts) et récapitulatif.
// A ouvre la page de vente, X retire l'article, Y ouvre la page de paiement de Valve (sous notre en-tête).
import { useMemo, useState } from 'react';
import { DialogButton, Focusable } from 'millennium';
import { CartItem, int, money, Owned, ownershipMap, plural } from '../pages/store/data';
import { CART_URL, CartLine, emptyCart, removeFromCart, useCartDetails } from '../pages/store/cart';
import { Capsule, IconCart, IconExternal, IconGift, IconPerson } from '../pages/store/ui';
import { bpNavigate, playerName, ROUTES } from '../core/steam';
import { BpFrame, goBackBp } from './Frame';
import { openSteamWebBp } from './StoreBar';
import { DiscountTag, Notice } from './Store';
import { BpStoreHead } from './storeLinks';

let lastFocus = '';

function Line({ line, item, owned, focus }: { line: CartLine; item?: CartItem; owned?: Owned; focus: boolean }) {
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState(false);
	const name = item?.name || (line.bundleid ? `Lot ${line.bundleid}` : `Article ${line.packageid}`);
	const kind = line.bundleid ? `Lot${item?.games ? ` · ${plural(item.games, 'article', 'articles')}` : ''}` : (item?.games ?? 1) > 1 ? `Édition · ${plural(item!.games!, 'jeu', 'jeux')}` : 'Jeu';
	const note = failed
		? { text: 'Steam a refusé le retrait de cet article', color: 'var(--sp-busy)' }
		: !line.valid
			? { text: 'Steam signale un problème avec cet article', color: 'var(--sp-busy)' }
			: owned?.kind === 'family'
				? { text: `${(item?.games ?? 1) > 1 ? 'Le jeu de base est déjà jouable' : 'Déjà jouable'} via la copie de ${owned.member.name}`, color: owned.member.color }
				: owned
					? { text: 'Le jeu est déjà dans votre bibliothèque', color: 'var(--sp-away)' }
					: null;
	const remove = async () => {
		setBusy(true);
		setFailed(!(await removeFromCart(line.id)));
		setBusy(false);
	};
	return (
		<DialogButton
			className="spbp-cartline"
			noFocusRing
			autoFocus={focus}
			aria-label={name}
			onClick={() => item?.appid && bpNavigate(ROUTES.bpStoreApp(item.appid))}
			onGamepadFocus={() => (lastFocus = line.id)}
			onOKActionDescription="Voir dans le magasin"
			{...(!busy ? { onSecondaryButton: remove, onSecondaryActionDescription: 'Retirer du panier' } : {})}
		>
			<span style={{ width: 300, flex: 'none' }}>{item ? <Capsule deal={item} radius="18px" /> : <span style={{ display: 'block', aspectRatio: '460 / 215', borderRadius: 18, background: 'var(--sp-surface2)' }} />}</span>
			<span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
				<span className="spbp-deal-name" style={{ fontSize: 25, fontWeight: 800 }}>{name}</span>
				<span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
					<span className="spbp-cart-tag" style={{ background: 'var(--sp-surface2)' }}>{kind}</span>
					<span className="spbp-cart-tag" style={{ border: '2px solid var(--sp-line)' }}>
						{line.gift ? <IconGift size={17} /> : <IconPerson size={17} />}
						{line.gift ? (line.giftee ? `Cadeau pour ${playerName(line.giftee)}` : 'Cadeau') : 'Pour vous'}
					</span>
					{busy && <span style={{ fontSize: 17, color: 'var(--sp-muted)' }}>Retrait…</span>}
				</span>
				{note && (
					<span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, color: note.color.includes('busy') ? note.color : 'var(--sp-text)' }}>
						<span className="spbp-dot" style={{ width: 12, height: 12, background: note.color }} />
						{note.text}
					</span>
				)}
			</span>
			<span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
				{item && item.discount > 0 && <DiscountTag pct={item.discount} big />}
				<span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.15, minWidth: 100 }}>
					{item && item.discount > 0 && item.original != null && <s style={{ fontSize: 17, color: 'var(--sp-muted)' }}>{money(item.original)}</s>}
					<span style={{ fontSize: 26, fontWeight: 800 }}>{item?.final != null ? money(item.final) : '…'}</span>
				</span>
			</span>
		</DialogButton>
	);
}

export function BpCart() {
	const own = useMemo(ownershipMap, []);
	const c = useCartDetails();
	const [confirmEmpty, setConfirmEmpty] = useState(false);
	const [emptying, setEmptying] = useState(false);
	const lines = c.cart?.lines || [];
	const pay = () => openSteamWebBp(CART_URL);
	const focusId = lines.some((l) => l.id === lastFocus) ? lastFocus : lines[0]?.id;
	const summary = lines.length ? `${plural(lines.length, 'article', 'articles')} · total estimé ${money(c.total)}` : '';

	const empty = async () => {
		if (!confirmEmpty) return setConfirmEmpty(true);
		setEmptying(true);
		await emptyCart();
		setEmptying(false);
		setConfirmEmpty(false);
	};

	return (
		<BpFrame tab="store" onBack={goBackBp} options={lines.length ? { label: 'Payer sur Steam', run: pay } : undefined} info={<span>{summary || 'Panier'}</span>}>
			<BpStoreHead title="Panier" info={summary} other="wishlist" />

			{c.loading ? (
				<div aria-hidden="true" style={{ margin: '34px 64px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
					{[0, 1, 2].map((i) => (
						<span key={i} style={{ height: 144, borderRadius: 26, background: 'var(--sp-surface2)', opacity: 0.5 - i * 0.1 }} />
					))}
				</div>
			) : c.error && !c.cart ? (
				<div style={{ marginTop: 34 }}>
					<Notice>Impossible de lire votre panier ({c.error}).</Notice>
				</div>
			) : !lines.length ? (
				<section aria-label="Panier vide" style={{ margin: '34px 64px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '80px 40px', borderRadius: 30, background: 'var(--sp-surface)', border: '2px solid var(--sp-line)', textAlign: 'center' }}>
					<span aria-hidden="true" style={{ width: 96, height: 96, borderRadius: 28, background: 'var(--sp-surface2)', color: 'var(--sp-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
						<IconCart size={44} />
					</span>
					<span style={{ fontSize: 32, fontWeight: 800 }}>Votre panier est vide</span>
					<span style={{ fontSize: 21, color: 'var(--sp-muted)', maxWidth: 640 }}>Ajoutez des jeux depuis votre liste de souhaits (X) ou la page de vente d’un jeu.</span>
					<Focusable flow-children="row" style={{ display: 'flex', gap: 16, marginTop: 10 }}>
						<DialogButton className="spbp-btn spbp-btn--primary" noFocusRing autoFocus onClick={() => bpNavigate(ROUTES.bpWishlist)} onOKActionDescription="Ouvrir">
							Votre liste de souhaits
						</DialogButton>
						<DialogButton className="spbp-btn" noFocusRing onClick={() => bpNavigate(ROUTES.bpStore)} onOKActionDescription="Ouvrir">
							Voir les promos
						</DialogButton>
					</Focusable>
				</section>
			) : (
				<Focusable flow-children="row" style={{ display: 'flex', gap: 40, margin: '34px 64px 40px', alignItems: 'flex-start' }}>
					<Focusable flow-children="column" aria-label="Votre panier" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14, padding: '6px 0' }}>
						{c.rows.map(({ line, item }) => (
							<Line key={line.id} line={line} item={item} owned={item?.appid ? own.get(item.appid) : undefined} focus={line.id === focusId} />
						))}
					</Focusable>
					<Focusable flow-children="column" aria-label="Récapitulatif" style={{ width: 520, flex: 'none', display: 'flex', flexDirection: 'column', gap: 18, padding: 32, borderRadius: 30, background: 'var(--sp-surface)', border: '2px solid var(--sp-line)' }}>
						<span className="spbp-label">Récapitulatif</span>
						{c.base != null && c.savings > 0 && (
							<>
								<span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 21 }}>
									<span style={{ color: 'var(--sp-muted)' }}>Prix de base</span>
									<span>{money(c.base)}</span>
								</span>
								<span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 21 }}>
									<span style={{ color: 'var(--sp-muted)' }}>Réductions</span>
									<span style={{ color: 'var(--sp-deal)', fontWeight: 800 }}>−{money(c.savings)}</span>
								</span>
								<span style={{ height: 2, background: 'var(--sp-line)' }} />
							</>
						)}
						<span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
							<span style={{ fontSize: 23, fontWeight: 800 }}>Total estimé</span>
							<span style={{ fontSize: 46, fontWeight: 800 }}>{money(c.total)}</span>
						</span>
						<span style={{ fontSize: 17, color: 'var(--sp-muted)', lineHeight: 1.45 }}>Le paiement se fait sur la page de Steam, qui confirme le total (taxes, bons de réduction) et le moyen de paiement.</span>
						<DialogButton className="spbp-btn spbp-btn--primary" noFocusRing onClick={pay} onOKActionDescription="Payer sur Steam">
							Payer sur Steam
							<IconExternal />
						</DialogButton>
						<DialogButton className="spbp-btn" noFocusRing disabled={emptying} onClick={empty} onOKActionDescription={confirmEmpty ? 'Confirmer' : 'Vider'}>
							{emptying ? 'Un instant…' : confirmEmpty ? 'Confirmer : tout retirer' : `Vider le panier (${int(lines.length)})`}
						</DialogButton>
					</Focusable>
				</Focusable>
			)}
		</BpFrame>
	);
}
