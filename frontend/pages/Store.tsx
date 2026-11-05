// Page Magasin (/steamupgraded/store) : promos de la liste de souhaits et promos du moment.
// Liste de souhaits et panier : leurs pages (Wishlist.tsx, Cart.tsx), boutons en tête de page.
import { useMemo, useState } from 'react';
import { filterDeals, loadFeatured, loadWishlist, mySteamId, ownershipMap, PAGE, plural, useAsync, useSpecials, wishlistOnSale, int, useStoreRegion } from './store/data';
import { Banner, DealRow, Notice, OpenFullStore, SectionHead, Skeleton, STORE_CSS, StoreTabs, WishlistSection } from './store/sections';
import { FilterChips, FilterPill, Filters, IconRefresh, NO_FILTERS, SortId, SortMenu } from './store/ui';
import { usePageTransition } from '../core/transitions';

// Conservés entre deux visites de la page (le cache des données vit dans data.ts)
let keptFilters: Filters = NO_FILTERS;
let keptSort: SortId = 'relevance';
let keptPages = 2;

export function StorePage() {
	const pageRef = usePageTransition();
	const steamid = mySteamId();
	const region = useStoreRegion();
	const own = useMemo(ownershipMap, []);
	const [featured, refreshFeatured] = useAsync((force) => loadFeatured(force), []);
	const [wishlist, refreshWishlist] = useAsync((force) => loadWishlist(steamid, force), [steamid]);

	const [filters, setFiltersState] = useState<Filters>(keptFilters);
	const [sort, setSortState] = useState<SortId>(keptSort);
	const setFilters = (f: Filters) => setFiltersState((keptFilters = f));
	const setSort = (s: SortId) => setSortState((keptSort = s));

	// Promos : pages de 100 chargées à la demande
	const [want, setWantState] = useState(keptPages);
	const setWant = (n: number) => setWantState((keptPages = n));
	const [force, setForce] = useState(0);
	const { pages, deals, total, loading: loadingDeals, error: dealsError, loadedAll } = useSpecials(want, force);

	const visible = useMemo(() => filterDeals(deals, filters, sort, own), [deals, filters, sort, own]);
	const onSale = useMemo(() => wishlistOnSale(wishlist.data), [wishlist.data]);

	const refreshAll = () => {
		refreshFeatured();
		refreshWishlist();
		setForce((n) => n + 1);
	};

	return (
		<div className="sp-root sps-page" ref={pageRef}>
			<style>{STORE_CSS}</style>
			<div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 36px 56px', display: 'flex', flexDirection: 'column', gap: 34 }}>
				<header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
					<div style={{ flex: 1, minWidth: 260 }}>
						<h1 className="sp-h1">Magasin</h1>
						<div className="sp-muted" style={{ marginTop: 2 }}>Les promos qui vous concernent. Prix du magasin : {region.countryName}, en {region.currencyName}.</div>
					</div>
					<button type="button" className="sp-btn sp-btn--icon" aria-label="Actualiser les promos" title="Actualiser" onClick={refreshAll}>
						<IconRefresh />
					</button>
					<OpenFullStore />
					<StoreTabs current="store" />
				</header>

				<Banner featured={featured} own={own} total={total} />

				<WishlistSection wishlist={wishlist} onSale={onSale} own={own} retry={refreshWishlist} />

				<section aria-label="Promos du moment">
					<SectionHead
						title="Promos du moment"
						sub={total ? `${int(total)} jeux et contenus en promo sur Steam · ${int(deals.length)} jeux chargés, dans l'ordre de pertinence du magasin` : undefined}
					/>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
						<FilterPill value={filters} onChange={setFilters} />
						<FilterChips value={filters} onChange={setFilters} />
						<span style={{ flex: 1 }} />
						{deals.length > 0 && <span className="sp-muted" style={{ fontSize: 13 }}>{plural(visible.length, 'jeu affiché', 'jeux affichés')}</span>}
						<SortMenu value={sort} onChange={setSort} />
					</div>

					{dealsError && !deals.length ? (
						<Notice action={<button type="button" className="sp-btn" onClick={() => setForce((n) => n + 1)}>Réessayer</button>}>
							Impossible de charger les promos ({dealsError}).
						</Notice>
					) : !deals.length && loadingDeals ? (
						<Skeleton h={96} n={6} gap={6} />
					) : !visible.length ? (
						<Notice action={<button type="button" className="sp-btn" onClick={() => setFilters(NO_FILTERS)}>Retirer les filtres</button>}>
							Aucune promo chargée ne correspond à ces filtres.
						</Notice>
					) : (
						<div className="sp-card" style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
							{visible.map((d) => (
								<DealRow key={d.appid} deal={d} owned={own.get(d.appid)} />
							))}
						</div>
					)}

					<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
						{dealsError && deals.length > 0 && <span className="sp-muted">Chargement interrompu ({dealsError}).</span>}
						{!loadedAll && deals.length > 0 && (
							<button type="button" className="sp-btn" disabled={loadingDeals} onClick={() => setWant(pages.length + 1)}>
								{loadingDeals ? 'Chargement…' : `Charger ${PAGE} promos de plus`}
							</button>
						)}
						<OpenFullStore />
					</div>
				</section>
			</div>
		</div>
	);
}
