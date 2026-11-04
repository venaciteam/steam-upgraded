// Liste de souhaits complète (/steamupgraded/souhaits), ouverte depuis le Magasin.
// Chiffres en tête, recherche, filtres et tris ; chaque jeu : page de vente, ajout au panier (cart.ts),
// retrait de la liste (service Wishlist du client Steam, voir setWishlisted ; confirmation par un second clic).
import { useEffect, useMemo, useState } from 'react';
import { navigate, openSteamWeb, openStorePage, ROUTES } from '../core/steam';
import { usePageTransition } from '../core/transitions';
import { capitalize, Deal, int, loadWishlist, money, mySteamId, Owned, ownershipMap, plural, reviewScore, reviewTone, setWishlisted, useAsync, useStoreRegion } from './store/data';
import { addToCart, lineFor, useCart } from './store/cart';
import { canBuy, filterWishlist, WISH_SORTS, wishFilters, WishFilter, wishNote, WishSort, wishStats } from './store/wishlist';
import { Notice, Skeleton, STORE_CSS, StoreTabs } from './store/sections';
import { Capsule, DiscountBadge, IconCart, IconCheck, IconExternal, IconHeart, IconRefresh, Prices, SortMenu } from './store/ui';

const STEP = 40;

// Conservés entre deux visites
let keptFilter: WishFilter = 'all';
let keptSort: WishSort = 'rank';

const WISH_CSS = `
.spw-row{display:grid;grid-template-columns:22px 150px minmax(0,1fr) 170px 150px 176px 36px;align-items:center;gap:16px;padding:8px 12px 8px 8px;border-radius:var(--sp-r-md);border:1px solid transparent;}
.spw-row:hover{background:var(--sp-surface2);border-color:var(--sp-accent);}
.spw-cart{height:36px;padding:0 12px;border-radius:11px;font-size:13px;font-weight:700;gap:7px;justify-content:center;white-space:nowrap;}
/* « Ajouter au panier » passe à l'accent au survol de sa ligne */
.spw-row:hover .spw-cart--buy:not(:disabled){background:var(--sp-accent);border-color:var(--sp-accent);color:var(--sp-accent-ink);box-shadow:var(--sp-glow);}
.spw-heart{width:36px;height:36px;padding:0;border-radius:11px;justify-content:center;color:var(--sp-accent);}
.spw-heart[data-confirm]{width:auto;padding:0 10px;color:var(--sp-busy);font-size:12px;font-weight:800;}
@media (max-width: 1100px){.spw-row{grid-template-columns:22px 120px minmax(0,1fr) 120px 176px 36px;}.spw-review{display:none;}}
`;

function Stat({ value, label, deal }: { value: string; label: string; deal?: boolean }) {
	return (
		<div className="sp-card" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '16px 18px', ...(deal ? { borderColor: 'var(--sp-deal)' } : {}) }}>
			<span style={{ fontSize: 24, fontWeight: 800, color: deal ? 'var(--sp-deal)' : undefined }}>{value}</span>
			<span className="sp-muted" style={{ fontSize: 12 }}>{label}</span>
		</div>
	);
}

function WishRow({ d, rank, owned, onRemoved }: { d: Deal; rank: number; owned?: Owned; onRemoved: (appid: number) => void }) {
	const { cart } = useCart();
	const inCart = !!lineFor(cart, d);
	const [busy, setBusy] = useState<'' | 'cart' | 'remove'>('');
	const [confirm, setConfirm] = useState(false);
	const [failed, setFailed] = useState('');
	const note = wishNote(d, owned);
	const buyable = canBuy(d) && owned?.kind !== 'me';

	useEffect(() => {
		if (!confirm) return undefined;
		const t = setTimeout(() => setConfirm(false), 4000);
		return () => clearTimeout(t);
	}, [confirm]);

	const add = async () => {
		if (inCart) return navigate(ROUTES.cart);
		setBusy('cart');
		setFailed('');
		if (!(await addToCart(d))) setFailed('Steam a refusé l’ajout au panier.');
		setBusy('');
	};
	const remove = async () => {
		if (!confirm) return setConfirm(true);
		setBusy('remove');
		if (await setWishlisted(d.appid, false)) onRemoved(d.appid);
		else setFailed('Steam a refusé le retrait de la liste.');
		setBusy('');
		setConfirm(false);
	};

	const name = d.name || `Jeu ${d.appid}`;
	return (
		<div className="spw-row">
			<span className="sp-muted" style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{rank}</span>
			<button type="button" onClick={() => openStorePage(d.appid)} aria-label={`Page de vente de ${name}`} style={{ padding: 0, border: 0, background: 'transparent', borderRadius: 'var(--sp-r-sm)' }}>
				<Capsule deal={d} width={150} />
			</button>
			<button type="button" onClick={() => openStorePage(d.appid)} style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, padding: 0, border: 0, background: 'transparent', textAlign: 'left' }}>
				<span style={{ maxWidth: '100%', fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
				{d.tags && d.tags.length > 0 && <span className="sp-muted" style={{ fontSize: 12 }}>{d.tags.join(' · ')}</span>}
				{(failed || note.text) && (
					<span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: failed ? 'var(--sp-busy)' : note.color ? 'var(--sp-text)' : 'var(--sp-muted)' }}>
						{!failed && <i aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: note.color || 'var(--sp-line)', flex: 'none' }} />}
						{failed || note.text}
					</span>
				)}
			</button>
			<span className="spw-review" style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
				{d.reviewLabel ? (
					<>
						<b style={{ color: reviewTone(reviewScore(d)) }}>{capitalize(d.reviewLabel)}</b>
						{d.reviewPct != null && <span className="sp-muted">{d.reviewPct}&#8239;%{d.reviewCount ? ` · ${int(d.reviewCount)} avis` : ''}</span>}
					</>
				) : (
					<span className="sp-muted">Pas encore d’évaluations</span>
				)}
			</span>
			<span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
				{d.comingSoon ? (
					<span className="sp-muted" style={{ fontWeight: 700 }}>À venir</span>
				) : (
					<>
						{d.discount > 0 && <DiscountBadge pct={d.discount} big />}
						<Prices deal={d} />
					</>
				)}
			</span>
			<button type="button" className={`sp-btn spw-cart${buyable && !inCart ? ' spw-cart--buy' : ''}`} disabled={(!buyable && !inCart) || !!busy} onClick={add}>
				{inCart ? <IconCheck /> : <IconCart />}
				{busy === 'cart' ? 'Un instant…' : inCart ? 'Dans le panier' : owned?.kind === 'me' ? 'Déjà à vous' : d.comingSoon ? 'Pas encore en vente' : buyable ? 'Ajouter au panier' : 'Indisponible'}
			</button>
			<button
				type="button"
				className="sp-btn spw-heart"
				data-confirm={confirm || undefined}
				disabled={!!busy}
				onClick={remove}
				aria-label={confirm ? `Confirmer : retirer ${name} de la liste de souhaits` : `Retirer ${name} de la liste de souhaits`}
				title={confirm ? undefined : 'Retirer de la liste'}
			>
				{confirm ? (busy === 'remove' ? '…' : 'Retirer ?') : <IconHeart on />}
			</button>
		</div>
	);
}

export function WishlistPage() {
	const pageRef = usePageTransition();
	const region = useStoreRegion();
	const own = useMemo(ownershipMap, []);
	const [wishlist, refresh] = useAsync((force) => loadWishlist(mySteamId(), force), []);
	const { refresh: refreshCart } = useCart();
	const [filter, setFilterState] = useState<WishFilter>(keptFilter);
	const [sort, setSortState] = useState<WishSort>(keptSort);
	const [query, setQuery] = useState('');
	const [shown, setShown] = useState(STEP);
	const [removed, setRemoved] = useState<Set<number>>(new Set());
	const setFilter = (f: WishFilter) => (setFilterState((keptFilter = f)), setShown(STEP));
	const setSort = (s: WishSort) => setSortState((keptSort = s));

	const wl = useMemo(() => (wishlist.data ? { ...wishlist.data, items: wishlist.data.items.filter((d) => !removed.has(d.appid)) } : undefined), [wishlist.data, removed]);
	const stats = wishStats(wl, own);
	const filters = wishFilters(wl, own);
	const q = query.trim().toLowerCase();
	const list = useMemo(() => filterWishlist((wl?.items || []).filter((d) => !q || (d.name || '').toLowerCase().includes(q)), filter, sort, own), [wl, filter, sort, own, q]);
	// rang dans votre ordre, quel que soit le tri affiché
	const ranks = useMemo(() => new Map(filterWishlist(wl?.items || [], 'all', 'rank', own).map((d, i) => [d.appid, i + 1])), [wl, own]);

	return (
		<div className="sp-root sps-page" ref={pageRef}>
			<style>{STORE_CSS + WISH_CSS}</style>
			<div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 36px 56px', display: 'flex', flexDirection: 'column', gap: 24 }}>
				<header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
					<div style={{ flex: 1, minWidth: 260 }}>
						<h1 className="sp-h1">Liste de souhaits</h1>
						<div className="sp-muted" style={{ marginTop: 2 }}>Prix du magasin : {region.countryName}, en {region.currencyName}.</div>
					</div>
					<button
						type="button"
						className="sp-btn sp-btn--icon"
						aria-label="Actualiser la liste et le panier"
						title="Actualiser"
						onClick={() => {
							setRemoved(new Set());
							refresh();
							refreshCart();
						}}
					>
						<IconRefresh />
					</button>
					<button type="button" className="sp-btn" onClick={() => openSteamWeb('https://store.steampowered.com/wishlist/')} style={{ alignItems: 'center' }}>
						<IconExternal />
						Liste sur Steam
					</button>
					<StoreTabs current="wishlist" />
				</header>

				{wishlist.loading && !wl ? (
					<Skeleton h={76} n={6} gap={6} />
				) : wishlist.error ? (
					<Notice action={<button type="button" className="sp-btn" onClick={refresh}>Réessayer</button>}>Impossible de lire votre liste de souhaits ({wishlist.error}).</Notice>
				) : !wl || wl.empty || !wl.items.length ? (
					<Notice action={<button type="button" className="sp-btn" onClick={() => navigate(ROUTES.store)}>Voir les promos</button>}>
						Votre liste de souhaits est vide ou privée. Ajoutez un jeu depuis sa page de vente (le cœur).
					</Notice>
				) : (
					<>
						<section aria-label="Résumé de votre liste" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
							<Stat value={int(stats.count)} label={`${stats.count > 1 ? 'jeux' : 'jeu'} dans votre liste${stats.soon ? ` · ${int(stats.soon)} à venir` : ''}`} />
							<Stat value={`${int(stats.sale)} en promo`} label={stats.save > 0 ? `${money(stats.save)} d’économie si vous ${stats.sale > 1 ? 'les preniez tous' : 'le preniez'}` : 'Aucune promo en ce moment'} deal={stats.sale > 0} />
							{stats.family > 0 && <Stat value={int(stats.family)} label="déjà jouables avec une copie de la famille" />}
						</section>

						<section aria-label="Votre liste de souhaits" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
							<div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
								<input type="search" className="sp-input" placeholder="Rechercher dans votre liste…" aria-label="Rechercher dans votre liste" value={query} onChange={(e) => setQuery(e.currentTarget.value)} style={{ width: 260, maxWidth: '100%', height: 38 }} />
								{filters.map((f) => (
									<button key={f.id} type="button" className="sp-pill" aria-pressed={f.id === filter} onClick={() => setFilter(f.id)} style={f.id === filter ? { borderColor: 'var(--sp-accent)', fontWeight: 800 } : undefined}>
										{f.label}
										{f.count != null && <span className="sp-muted"> · {int(f.count)}</span>}
									</button>
								))}
								<span style={{ flex: 1 }} />
								<span className="sp-muted" style={{ fontSize: 13 }}>{plural(list.length, 'jeu affiché', 'jeux affichés')}</span>
								<SortMenu value={sort} onChange={setSort} options={WISH_SORTS} />
							</div>

							{!list.length ? (
								<Notice action={<button type="button" className="sp-btn" onClick={() => (setFilter('all'), setQuery(''))}>Tout afficher</button>}>Aucun jeu de votre liste ne correspond.</Notice>
							) : (
								<div className="sp-card" style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
									{list.slice(0, shown).map((d) => (
										<WishRow key={d.appid} d={d} rank={ranks.get(d.appid) || 0} owned={own.get(d.appid)} onRemoved={(id) => setRemoved((s) => new Set(s).add(id))} />
									))}
								</div>
							)}
							{list.length > shown && (
								<div style={{ display: 'flex', justifyContent: 'center' }}>
									<button type="button" className="sp-btn" onClick={() => setShown((n) => n + STEP)}>
										Afficher les {int(Math.min(STEP, list.length - shown))} suivants
									</button>
								</div>
							)}
						</section>
					</>
				)}
			</div>
		</div>
	);
}

