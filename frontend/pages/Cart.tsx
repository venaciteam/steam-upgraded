// Panier (/steamupgraded/panier), ouvert depuis le Magasin et la liste de souhaits.
// Articles du panier du compte (lus par le client Steam, voir store/cart.ts), retrait d'un article ou de tous,
// récapitulatif ; « Payer sur Steam » ouvre la page de Valve, où se fait le paiement.
import { useEffect, useMemo, useState } from 'react';
import { navigate, openSteamWeb, openStorePage, playerName, ROUTES } from '../core/steam';
import { usePageTransition } from '../core/transitions';
import { CartItem, int, loadWishlist, money, mySteamId, Owned, ownershipMap, plural, useAsync, wishlistOnSale } from './store/data';
import type { Deal } from './store/data';
import { addToCart, CART_URL, CartLine, emptyCart, lineFor, removeFromCart, useCartDetails } from './store/cart';
import { Notice, Skeleton, STORE_CSS, StoreTabs } from './store/sections';
import { Capsule, DiscountBadge, IconCart, IconExternal, IconGift, IconPerson, IconPlus, IconRefresh, IconTrash, Prices } from './store/ui';

const CART_CSS = `
.spc-line{display:grid;grid-template-columns:184px minmax(0,1fr) auto 36px;align-items:center;gap:16px;padding:10px 12px 10px 10px;border-radius:var(--sp-r-md);border:1px solid transparent;}
.spc-line:hover{background:var(--sp-surface2);border-color:var(--sp-accent);}
.spc-tag{height:24px;padding:0 8px;display:inline-flex;align-items:center;gap:5px;border-radius:6px;font-size:12px;font-weight:700;}
.spc-icon{width:36px;height:36px;padding:0;border-radius:11px;justify-content:center;color:var(--sp-muted);}
.spc-icon:hover:not(:disabled){color:var(--sp-text);}
`;

function lineNote(item: CartItem | undefined, owned?: Owned): { text: string; color: string } | null {
	if (!item) return null;
	if (owned?.kind === 'family') return { text: `${(item.games ?? 1) > 1 ? 'Le jeu de base est déjà jouable' : 'Déjà jouable'} via la copie de ${owned.member.name}`, color: owned.member.color };
	if (owned) return { text: 'Le jeu est déjà dans votre bibliothèque', color: 'var(--sp-away)' };
	return null;
}

function Line({ line, item, owned }: { line: CartLine; item?: CartItem; owned?: Owned }) {
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState(false);
	const name = item?.name || (line.bundleid ? `Lot ${line.bundleid}` : `Article ${line.packageid}`);
	const note = lineNote(item, owned);
	const open = item?.appid ? () => openStorePage(item.appid) : undefined;
	const kind = line.bundleid ? `Lot${item?.games ? ` · ${plural(item.games, 'article', 'articles')}` : ''}` : (item?.games ?? 1) > 1 ? `Édition · ${plural(item!.games!, 'jeu', 'jeux')}` : 'Jeu';
	const remove = async () => {
		setBusy(true);
		setFailed(!(await removeFromCart(line.id)));
		setBusy(false);
	};
	return (
		<div className="spc-line">
			<button type="button" onClick={open} disabled={!open} aria-label={`Page de vente de ${name}`} style={{ padding: 0, border: 0, background: 'transparent' }}>
				{item ? <Capsule deal={item} width={184} /> : <span style={{ display: 'block', width: 184, aspectRatio: '460 / 215', borderRadius: 'var(--sp-r-sm)', background: 'var(--sp-surface2)' }} />}
			</button>
			<span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
				<button type="button" onClick={open} disabled={!open} style={{ padding: 0, border: 0, background: 'transparent', textAlign: 'left', fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--sp-text)', opacity: 1 }}>
					{name}
				</button>
				<span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
					<span className="spc-tag" style={{ background: 'var(--sp-surface2)' }}>{kind}</span>
					<span className="spc-tag" style={{ border: '1px solid var(--sp-line)' }}>
						{line.gift ? <IconGift /> : <IconPerson />}
						{line.gift ? (line.giftee ? `Cadeau pour ${playerName(line.giftee)}` : 'Cadeau') : 'Pour vous'}
					</span>
				</span>
				{(failed || note || !line.valid) && (
					<span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: failed || !line.valid ? 'var(--sp-busy)' : 'var(--sp-text)' }}>
						{!failed && line.valid && <i aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: note!.color, flex: 'none' }} />}
						{failed ? 'Steam a refusé le retrait de cet article.' : !line.valid ? 'Steam signale un problème avec cet article : vérifiez-le sur la page du panier.' : note!.text}
					</span>
				)}
			</span>
			<span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
				{item && item.discount > 0 && <DiscountBadge pct={item.discount} big />}
				<span style={{ minWidth: 72, display: 'inline-flex', justifyContent: 'flex-end' }}>{item ? <Prices deal={item} /> : <span className="sp-muted">…</span>}</span>
			</span>
			<button type="button" className="sp-btn spc-icon" disabled={busy} onClick={remove} aria-label={`Retirer ${name} du panier`} title="Retirer du panier">
				<IconTrash />
			</button>
		</div>
	);
}

/** Souhaits en promo absents du panier : ajout en un clic. */
function MoreDeals({ deals }: { deals: Deal[] }) {
	const [busy, setBusy] = useState(0);
	if (!deals.length) return null;
	return (
		<>
			<div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 14 }}>
				<h2 className="sp-h2" style={{ fontSize: 17 }}>Aussi en promo dans votre liste de souhaits</h2>
				<a role="button" tabIndex={0} onClick={() => navigate(ROUTES.wishlist)} style={{ color: 'var(--sp-accent)', fontWeight: 700, cursor: 'pointer' }}>
					Toute la liste →
				</a>
			</div>
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
				{deals.map((d) => (
					<div key={d.appid} className="sp-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
						<button type="button" onClick={() => openStorePage(d.appid)} style={{ padding: 0, border: 0, background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8, textAlign: 'left' }}>
							<Capsule deal={d} radius="var(--sp-r-sm)" />
							<span style={{ padding: '0 4px', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{d.name}</span>
						</button>
						<span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 2px' }}>
							<DiscountBadge pct={d.discount} />
							<Prices deal={d} align="start" />
							<span style={{ flex: 1 }} />
							<button
								type="button"
								className="sp-btn spc-icon"
								disabled={busy === d.appid}
								aria-label={`Ajouter ${d.name || 'ce jeu'} au panier`}
								title="Ajouter au panier"
								onClick={async () => {
									setBusy(d.appid);
									await addToCart(d);
									setBusy(0);
								}}
							>
								<IconPlus />
							</button>
						</span>
					</div>
				))}
			</div>
		</>
	);
}

export function CartPage() {
	const pageRef = usePageTransition();
	const own = useMemo(ownershipMap, []);
	const c = useCartDetails();
	const [wl] = useAsync((force) => loadWishlist(mySteamId(), force), []);
	const [confirmEmpty, setConfirmEmpty] = useState(false);
	const [emptying, setEmptying] = useState(false);
	const lines = c.cart?.lines || [];

	useEffect(() => {
		if (!confirmEmpty) return undefined;
		const t = setTimeout(() => setConfirmEmpty(false), 4000);
		return () => clearTimeout(t);
	}, [confirmEmpty]);

	const more = wishlistOnSale(wl.data)
		.filter((d) => (d.packageid || d.bundleid) && !lineFor(c.cart, d) && !own.has(d.appid))
		.slice(0, 4);

	const empty = async () => {
		if (!confirmEmpty) return setConfirmEmpty(true);
		setEmptying(true);
		await emptyCart();
		setEmptying(false);
		setConfirmEmpty(false);
	};

	return (
		<div className="sp-root sps-page" ref={pageRef}>
			<style>{STORE_CSS + CART_CSS}</style>
			<div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 36px 56px', display: 'flex', flexDirection: 'column', gap: 24 }}>
				<header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
					<div style={{ flex: 1, minWidth: 260 }}>
						<h1 className="sp-h1">Panier</h1>
						<div className="sp-muted" style={{ marginTop: 2 }}>Le panier de votre compte Steam, le même que sur le site du magasin.</div>
					</div>
					<button type="button" className="sp-btn sp-btn--icon" aria-label="Actualiser le panier" title="Actualiser" onClick={c.refresh}>
						<IconRefresh />
					</button>
					<button type="button" className="sp-btn" onClick={() => openSteamWeb(CART_URL)} style={{ alignItems: 'center' }}>
						<IconExternal />
						Panier sur Steam
					</button>
					<StoreTabs current="cart" />
				</header>

				{c.loading ? (
					<Skeleton h={92} n={3} gap={6} />
				) : c.error && !c.cart ? (
					<Notice action={<button type="button" className="sp-btn" onClick={c.refresh}>Réessayer</button>}>Impossible de lire votre panier ({c.error}).</Notice>
				) : !lines.length ? (
					<section aria-label="Panier vide" className="sp-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '64px 24px', textAlign: 'center' }}>
						<span aria-hidden="true" style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--sp-surface2)', color: 'var(--sp-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
							<IconCart size={30} />
						</span>
						<span style={{ fontSize: 20, fontWeight: 800 }}>Votre panier est vide</span>
						<span className="sp-muted" style={{ maxWidth: 420, lineHeight: 1.5 }}>Ajoutez des jeux depuis votre liste de souhaits, les promos ou la page de vente d’un jeu.</span>
						<span style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 6 }}>
							<button type="button" className="sp-btn sp-btn--primary" onClick={() => navigate(ROUTES.wishlist)}>
								Votre liste de souhaits{wishlistOnSale(wl.data).length ? ` · ${int(wishlistOnSale(wl.data).length)} en promo` : ''}
							</button>
							<button type="button" className="sp-btn" onClick={() => navigate(ROUTES.store)}>
								Voir les promos
							</button>
						</span>
					</section>
				) : (
					<div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 24 }}>
						<section aria-labelledby="spc-items" style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
							<div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
								<h2 id="spc-items" className="sp-h2">Votre panier</h2>
								<span className="sp-muted">{plural(lines.length, 'article', 'articles')}</span>
							</div>
							<div className="sp-card" style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
								{c.rows.map(({ line, item }) => (
									<Line key={line.id} line={line} item={item} owned={item?.appid ? own.get(item.appid) : undefined} />
								))}
							</div>
							{c.itemsError && <span className="sp-muted" style={{ fontSize: 12 }}>Détails des articles indisponibles ({c.itemsError}).</span>}
							<MoreDeals deals={more} />
						</section>

						<aside aria-label="Récapitulatif" className="sp-card" style={{ flex: '1 1 320px', maxWidth: 380, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14, padding: 22, borderRadius: 'var(--sp-r-lg)', position: 'sticky', top: 20 }}>
							<span className="sp-label">Récapitulatif</span>
							{c.base != null && c.savings > 0 && (
								<>
									<div style={{ display: 'flex', justifyContent: 'space-between' }}>
										<span className="sp-muted">Prix de base</span>
										<span>{money(c.base)}</span>
									</div>
									<div style={{ display: 'flex', justifyContent: 'space-between' }}>
										<span className="sp-muted">Réductions</span>
										<span style={{ color: 'var(--sp-deal)', fontWeight: 700 }}>−{money(c.savings)}</span>
									</div>
									<div style={{ height: 1, background: 'var(--sp-line)' }} />
								</>
							)}
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
								<span style={{ fontWeight: 800, fontSize: 16 }}>Total estimé</span>
								<span style={{ fontWeight: 800, fontSize: 28 }}>{money(c.total)}</span>
							</div>
							<span className="sp-muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
								Le paiement se fait sur la page de Steam, qui confirme le total (taxes, bons de réduction) et le moyen de paiement.
							</span>
							<button type="button" className="sp-btn sp-btn--primary" onClick={() => openSteamWeb(CART_URL)} style={{ height: 48, justifyContent: 'center', fontSize: 15, gap: 10 }}>
								Payer sur Steam
								<IconExternal />
							</button>
							<button type="button" className="sp-btn" onClick={() => navigate(ROUTES.store)} style={{ height: 44, justifyContent: 'center' }}>
								Continuer mes achats
							</button>
							<button
								type="button"
								onClick={empty}
								disabled={emptying}
								style={{ alignSelf: 'center', height: 36, padding: '0 12px', border: 0, borderRadius: 10, background: 'transparent', color: confirmEmpty ? 'var(--sp-busy)' : 'var(--sp-muted)', fontWeight: confirmEmpty ? 800 : 600 }}
							>
								{emptying ? 'Un instant…' : confirmEmpty ? 'Confirmer : tout retirer du panier' : 'Vider le panier…'}
							</button>
						</aside>
					</div>
				)}
			</div>
		</div>
	);
}
