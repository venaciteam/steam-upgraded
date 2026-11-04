// Big Picture › Magasin › Liste de souhaits : toute la liste en grille de quatre, filtres rapides.
// A ouvre notre page de vente, X ajoute au panier (ou ouvre le panier si le jeu y est), Y change le tri.
// Le retrait de la liste se fait depuis la page de vente (Y), comme l'ajout.
import { useMemo, useState } from 'react';
import { DialogButton, Focusable } from 'millennium';
import { Deal, int, loadWishlist, money, mySteamId, Owned, ownershipMap, plural, useAsync } from '../pages/store/data';
import { addToCart, lineFor, useCart } from '../pages/store/cart';
import { canBuy, filterWishlist, WISH_SORTS, wishFilters, WishFilter, wishNote, WishSort, wishStats } from '../pages/store/wishlist';
import { Capsule } from '../pages/store/ui';
import { bpNavigate, myAccountId, ROUTES } from '../core/steam';
import { BpFrame, goBackBp, MemberAvatar } from './Frame';
import { DiscountTag, Notice } from './Store';
import { BpStoreHead } from './storeLinks';

// Gardés d'une visite à l'autre (retour depuis une page de vente)
let lastFilter: WishFilter = 'all';
let lastSort: WishSort = 'rank';
let lastFocus = 0;

function WishCard({ d, rank, owned, focus }: { d: Deal; rank: number; owned?: Owned; focus: boolean }) {
	const { cart } = useCart();
	const inCart = !!lineFor(cart, d);
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState(false);
	const note = wishNote(d, owned);
	const family = owned?.kind === 'family' ? owned.member : null;
	const buyable = canBuy(d) && owned?.kind !== 'me';
	const add = async () => {
		if (inCart) return bpNavigate(ROUTES.bpCart);
		setBusy(true);
		setFailed(!(await addToCart(d)));
		setBusy(false);
	};
	const name = d.name || `Jeu ${d.appid}`;
	return (
		<DialogButton
			className="spbp-deal"
			noFocusRing
			autoFocus={focus}
			aria-label={name}
			onClick={() => bpNavigate(ROUTES.bpStoreApp(d.appid))}
			onGamepadFocus={() => (lastFocus = d.appid)}
			onOKActionDescription="Voir dans le magasin"
			{...((buyable || inCart) && !busy ? { onSecondaryButton: add, onSecondaryActionDescription: inCart ? 'Voir le panier' : 'Ajouter au panier' } : {})}
		>
			<Capsule deal={d} radius="20px" />
			<span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
				<span style={{ fontSize: 16, fontWeight: 800, color: 'var(--sp-muted)', fontVariantNumeric: 'tabular-nums' }}>{rank}</span>
				<span className="spbp-deal-name" style={{ fontSize: 22, fontWeight: 800 }}>{name}</span>
			</span>
			<span style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52 }}>
				{d.comingSoon ? (
					<span style={{ fontSize: 22, fontWeight: 800, color: 'var(--sp-muted)' }}>À venir</span>
				) : (
					<>
						{d.discount > 0 && <DiscountTag pct={d.discount} big />}
						<span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
							{d.discount > 0 && d.original != null && <s style={{ fontSize: 16, color: 'var(--sp-muted)' }}>{money(d.original)}</s>}
							<span style={{ fontSize: 22, fontWeight: 800 }}>{d.final === 0 ? 'Gratuit' : d.final != null ? money(d.final) : 'Prix indisponible'}</span>
						</span>
					</>
				)}
				<span style={{ flex: 1 }} />
				{(inCart || busy) && (
					<span className="spbp-cart-tag" style={{ background: 'var(--sp-surface2)', fontSize: 16 }}>
						{busy ? 'Ajout…' : 'Dans le panier'}
					</span>
				)}
			</span>
			<span style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 24, fontSize: 16, color: failed ? 'var(--sp-busy)' : note.color ? 'var(--sp-text)' : 'var(--sp-muted)' }}>
				{!failed && note.text && (owned ? <MemberAvatar accountId={family?.accountId ?? myAccountId()} color={family?.color || 'var(--sp-accent)'} size={24} /> : <span className="spbp-dot" style={{ width: 12, height: 12, background: 'var(--sp-line)' }} />)}
				<span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{failed ? 'Steam a refusé l’ajout au panier' : note.text}</span>
			</span>
		</DialogButton>
	);
}

export function BpWishlist() {
	const own = useMemo(ownershipMap, []);
	const [wishlist] = useAsync((force) => loadWishlist(mySteamId(), force), []);
	const [filter, setFilterState] = useState<WishFilter>(lastFilter);
	const [sort, setSortState] = useState<WishSort>(lastSort);
	const wl = wishlist.data;
	const list = useMemo(() => filterWishlist(wl?.items || [], filter, sort, own), [wl, filter, sort, own]);
	const ranks = useMemo(() => new Map(filterWishlist(wl?.items || [], 'all', 'rank', own).map((d, i) => [d.appid, i + 1])), [wl, own]);
	const stats = wishStats(wl, own);
	const focusId = list.some((d) => d.appid === lastFocus) ? lastFocus : list[0]?.appid;

	const setFilter = (f: WishFilter) => setFilterState((lastFilter = f));
	const nextSort = () => {
		const i = WISH_SORTS.findIndex((s) => s.id === sort);
		lastFocus = 0;
		setSortState((lastSort = WISH_SORTS[(i + 1) % WISH_SORTS.length].id));
	};
	const sortLabel = (WISH_SORTS.find((s) => s.id === sort)?.label || '').toLowerCase();
	const summary = wl?.ok && !wl.empty ? [plural(stats.count, 'jeu', 'jeux'), stats.sale ? `${int(stats.sale)} en promo` : '', stats.family ? `${int(stats.family)} jouables via la famille` : ''].filter(Boolean).join(' · ') : '';

	return (
		<BpFrame tab="store" onBack={goBackBp} options={{ label: 'Trier', run: nextSort }} info={<span>{summary || 'Liste de souhaits'}</span>}>
			<BpStoreHead title="Liste de souhaits" info={summary} other="cart" />

			<section aria-label="Votre liste de souhaits" style={{ margin: '34px 0 0', display: 'flex', flexDirection: 'column', gap: 22, padding: '0 64px 40px' }}>
				<Focusable flow-children="row" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
					{wishFilters(wl, own).map((f) => (
						<DialogButton key={f.id} className="spbp-pill" noFocusRing aria-pressed={f.id === filter} onClick={() => setFilter(f.id)} onOKActionDescription="Filtrer">
							{f.label}
							{f.count != null ? ` · ${int(f.count)}` : ''}
						</DialogButton>
					))}
					<span style={{ flex: 1 }} />
					<span style={{ fontSize: 19, color: 'var(--sp-muted)' }}>tri : {sortLabel}</span>
				</Focusable>

				{wishlist.loading && !wl ? (
					<div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 30 }}>
						{[0, 1, 2, 3].map((i) => (
							<span key={i} style={{ height: 300, borderRadius: 20, background: 'var(--sp-surface2)', opacity: 0.5 - i * 0.07 }} />
						))}
					</div>
				) : wishlist.error ? (
					<Notice>Impossible de lire votre liste de souhaits ({wishlist.error}).</Notice>
				) : !wl || wl.empty ? (
					<Notice>Votre liste de souhaits est vide ou privée. Ajoutez un jeu depuis sa page de vente (Y).</Notice>
				) : !list.length ? (
					<p style={{ margin: 0, fontSize: 22, color: 'var(--sp-muted)' }}>Aucun jeu de votre liste ne correspond à ce filtre.</p>
				) : (
					// remontée à chaque tri et filtre : les cartes ne sont pas déplacées sous le focus et autoFocus s'applique
					<Focusable key={`${sort}:${filter}`} flow-children="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '36px 30px', paddingTop: 10 }}>
						{list.map((d) => (
							<WishCard key={d.appid} d={d} rank={ranks.get(d.appid) || 0} owned={own.get(d.appid)} focus={d.appid === focusId} />
						))}
					</Focusable>
				)}
			</section>
		</BpFrame>
	);
}
