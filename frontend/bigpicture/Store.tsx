// Big Picture › Magasin : bandeau de l'évènement Steam en cours, liste de souhaits en promo, promos du moment.
// Mêmes données que le Magasin du bureau. A ouvre notre page de vente du jeu (StoreApp.tsx),
// X ouvre tout le magasin de Steam (sous notre en-tête), Y change le tri. Lecture seule : aucun achat, aucune modification de la liste de souhaits.
import { useMemo, useState } from 'react';
import { DialogButton, Focusable } from 'millennium';
import { capitalize, money, moneyRound, priceSteps, filterDeals, int, loadFeatured, loadWishlist, mySteamId, ownershipMap, PAGE, plural, promoEndWhen, reviewScore, reviewTone, saleSubject, useAsync, useSpecials, wishlistOnSale } from '../pages/store/data';
import type { Deal, Featured, Owned, Wishlist } from '../pages/store/data';
import { Capsule, NO_FILTERS, SORTS } from '../pages/store/ui';
import type { Filters, SortId } from '../pages/store/ui';
import { useSettings } from '../core/settings';
import { bpNavigate, bpWindow, myAccountId, ROUTES } from '../core/steam';
import { BpFrame, goBackBp, MemberAvatar } from './Frame';
import { openSteamWebBp } from './StoreBar';

/** Filtres rapides ; « Moins de … » suit la devise du magasin (absent pour une devise non prévue). */
function pills(): { id: string; label: string; filters: Filters }[] {
	const steps = priceSteps();
	return [
		{ id: 'all', label: 'Toutes', filters: NO_FILTERS },
		{ id: 'half', label: '−50 % et plus', filters: { ...NO_FILTERS, minDiscount: 50 } },
		...(steps ? [{ id: 'cheap', label: `Moins de ${moneyRound(steps[1])}`, filters: { ...NO_FILTERS, maxPrice: steps[1] } }] : []),
		{ id: 'nodup', label: 'Sans doublon famille', filters: { ...NO_FILTERS, hideOwned: true } },
	];
}

// Gardés d'une visite à l'autre (retour depuis le magasin de Steam)
let lastPill = 'all';
let lastSort: SortId = 'discount';
let lastFocus = '';
let lastPages = 2;
let focusFirstDeal = false;

const SEASONAL = /soldes|festival/i;

/** « Fin de la promo le 5 novembre », « … dans 3 h » ; vide si Steam ne donne pas de date. */
function promoEnd(rt?: number): string {
	const when = promoEndWhen(rt);
	return when ? `Fin de la promo ${when}` : '';
}

function DiscountTag({ pct, big }: { pct: number; big?: boolean }) {
	return (
		<span style={{ padding: big ? '6px 10px' : '4px 8px', borderRadius: big ? 10 : 8, background: 'var(--sp-deal)', color: 'var(--sp-deal-ink)', fontSize: big ? 20 : 18, fontWeight: 800, flex: 'none' }}>
			−{pct}&#8239;%
		</span>
	);
}

function price(d: Deal): string {
	return d.final === 0 ? 'Gratuit' : money(d.final);
}

// ---------- Bandeau ----------

function Banner({ featured, total, onSale, wl }: { featured?: Featured; total: number; onSale: Deal[]; wl?: Wishlist }) {
	const spot = featured?.spotlights || [];
	const seasonal = spot.find((s) => SEASONAL.test(s.name));
	const event = seasonal || spot.find((s) => /\/sale\//.test(s.url));
	const others = spot.filter((s) => s !== event && /\/sale\//.test(s.url)).length;
	const subject = event && !seasonal ? saleSubject(event.url) : '';
	const title = event ? `${capitalize(event.name.toLowerCase())}${subject ? ` : ${subject}` : ''}` : 'Les promos du moment sur Steam';
	const facts = [total ? `${int(total)} jeux et contenus en promo sur Steam` : '', others ? plural(others, 'autre promo mise en avant', 'autres promos mises en avant') : ''].filter(Boolean).join(' · ');
	const save = onSale.reduce((n, d) => n + Math.max(0, (d.original ?? 0) - (d.final ?? 0)), 0);
	const s = useSettings();

	return (
		<section
			aria-label="Évènement en cours"
			data-reveal-block
			style={{ margin: '34px 64px 0', display: 'flex', alignItems: 'center', gap: 40, padding: '30px 36px', borderRadius: 30, border: '2px solid var(--sp-deal)', background: s.bpTheme === 'oled' ? 'var(--sp-bg)' : 'color-mix(in srgb, var(--sp-deal) 9%, var(--sp-bg))' }}
		>
			<div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
				<span className="spbp-label" style={{ color: 'var(--sp-deal)', letterSpacing: '0.12em' }}>
					{seasonal ? 'Soldes en cours' : 'Promotion en cours'}
				</span>
				<span style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
				{facts && <span style={{ fontSize: 20, color: 'var(--sp-muted)' }}>{facts}</span>}
			</div>
			{wl?.ok && !wl.empty && (
				<>
					<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
						<span style={{ fontSize: 52, fontWeight: 800, color: 'var(--sp-deal)', lineHeight: 1 }}>{int(onSale.length)}</span>
						<span style={{ fontSize: 18, color: 'var(--sp-muted)' }}>{onSale.length > 1 ? 'souhaits en promo' : 'souhait en promo'}</span>
					</div>
					{save > 0 && (
						<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
							<span style={{ fontSize: 52, fontWeight: 800, lineHeight: 1 }}>−{money(save)}</span>
							<span style={{ fontSize: 18, color: 'var(--sp-muted)' }}>{onSale.length > 1 ? `d’économie sur ces ${int(onSale.length)}` : 'd’économie'}</span>
						</div>
					)}
				</>
			)}
			<DialogButton
				className="spbp-btn"
				noFocusRing
				onClick={() => openSteamWebBp(event?.url || 'https://store.steampowered.com/specials/')}
				onOKActionDescription="Ouvrir"
			>
				{event ? 'Voir l’évènement' : 'Toutes les promos'}
			</DialogButton>
		</section>
	);
}

// ---------- Liste de souhaits en promo ----------

function WishCard({ d, owned, focus }: { d: Deal; owned?: Owned; focus: boolean }) {
	const key = `w:${d.appid}`;
	const family = owned?.kind === 'family' ? owned.member : null;
	const note = family ? `Déjà jouable via la copie de ${family.name}` : owned ? 'Déjà dans votre bibliothèque' : promoEnd(d.discountEnd);
	return (
		<DialogButton
			className="spbp-wish"
			noFocusRing
			autoFocus={focus}
			aria-label={d.name || `Jeu ${d.appid}`}
			onClick={() => bpNavigate(ROUTES.bpStoreApp(d.appid))}
			onGamepadFocus={() => (lastFocus = key)}
			onOKActionDescription="Page du jeu"
		>
			<Capsule deal={d} radius="20px" />
			<span className="spbp-deal-name" style={{ fontSize: 21, fontWeight: 800 }}>{d.name || `Jeu ${d.appid}`}</span>
			<span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
				<DiscountTag pct={d.discount} big />
				<span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
					{d.original != null && d.final != null && d.original > d.final && <s style={{ fontSize: 16, color: 'var(--sp-muted)' }}>{money(d.original)}</s>}
					<span style={{ fontSize: 22, fontWeight: 800 }}>{price(d)}</span>
				</span>
			</span>
			<span style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 21, fontSize: 16, color: family || owned ? 'var(--sp-text)' : 'var(--sp-muted)' }}>
				{note && (family || owned ? <MemberAvatar accountId={family?.accountId ?? myAccountId()} color={family?.color || 'var(--sp-accent)'} size={24} /> : <span className="spbp-dot" style={{ width: 12, height: 12, background: 'var(--sp-line)' }} />)}
				<span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note}</span>
			</span>
		</DialogButton>
	);
}

function Notice({ children }: { children: any }) {
	return <p style={{ margin: '0 64px', padding: '26px 30px', borderRadius: 26, background: 'var(--sp-surface)', border: '1px solid var(--sp-line)', fontSize: 22, color: 'var(--sp-muted)' }}>{children}</p>;
}

function WishlistRow({ wishlist, onSale, own, focusKey }: { wishlist: { data?: Wishlist; error?: string; loading: boolean }; onSale: Deal[]; own: Map<number, Owned>; focusKey: string }) {
	const wl = wishlist.data;
	return (
		<section aria-labelledby="spbp-wish" style={{ margin: '38px 0 0', display: 'flex', flexDirection: 'column', gap: 18 }}>
			<div style={{ display: 'flex', alignItems: 'baseline', gap: 16, padding: '0 64px' }}>
				<h2 id="spbp-wish" className="spbp-h2">
					Votre liste de souhaits en promo
				</h2>
				{wl?.ok && !wl.empty && (
					<span style={{ fontSize: 20, color: 'var(--sp-muted)' }}>
						{int(onSale.length)} sur {int(wl.count)}
					</span>
				)}
			</div>
			{wishlist.loading && !wl ? (
				<div aria-hidden="true" style={{ display: 'flex', gap: 24, padding: '8px 64px 0' }}>
					{[0, 1, 2, 3, 4].map((i) => (
						<span key={i} style={{ width: 340, height: 280, flex: 'none', borderRadius: 26, background: 'var(--sp-surface2)', opacity: 0.5 - i * 0.07 }} />
					))}
				</div>
			) : wishlist.error ? (
				<Notice>Impossible de lire votre liste de souhaits ({wishlist.error}).</Notice>
			) : !wl || wl.empty ? (
				<Notice>Votre liste de souhaits est vide ou privée : rien à surveiller ici pour l’instant.</Notice>
			) : !onSale.length ? (
				<Notice>Aucun jeu de votre liste de souhaits n’est en promo pour le moment.</Notice>
			) : (
				// rangée à défilement horizontal, donc rognée aussi en hauteur : de la marge pour le contour et le halo
				// de la carte agrandie, compensée par des marges négatives ; écart de 36 : la carte focalisée déborde
				// d'environ 26 px de chaque côté (cadre, agrandissement, liseré)
				<Focusable flow-children="row" style={{ display: 'flex', gap: 36, padding: '30px 64px 64px', margin: '-12px 0 -38px', overflowX: 'auto', scrollbarWidth: 'none' } as any}>
					{onSale.map((d) => (
						<WishCard key={d.appid} d={d} owned={own.get(d.appid)} focus={`w:${d.appid}` === focusKey} />
					))}
				</Focusable>
			)}
		</section>
	);
}

// ---------- Promos du moment ----------

function DealCard({ d, focus }: { d: Deal; focus: boolean }) {
	const key = `d:${d.appid}`;
	const score = reviewScore(d);
	return (
		<DialogButton
			className="spbp-deal"
			noFocusRing
			autoFocus={focus}
			aria-label={d.name || `Jeu ${d.appid}`}
			onClick={() => bpNavigate(ROUTES.bpStoreApp(d.appid))}
			onGamepadFocus={() => (lastFocus = key)}
			onOKActionDescription="Page du jeu"
		>
			<Capsule deal={d} radius="20px" />
			<span className="spbp-deal-name" style={{ fontSize: 19, fontWeight: 700 }}>{d.name || `Jeu ${d.appid}`}</span>
			<span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18, minWidth: 0 }}>
				<DiscountTag pct={d.discount} />
				<span style={{ fontWeight: 800, flex: 'none' }}>{price(d)}</span>
				{d.reviewLabel && (
					<span style={{ fontSize: 15, color: score ? reviewTone(score) : 'var(--sp-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{capitalize(d.reviewLabel)}</span>
				)}
			</span>
		</DialogButton>
	);
}

export function BpStore() {
	const steamid = mySteamId();
	const own = useMemo(ownershipMap, []);
	const [featured] = useAsync((force) => loadFeatured(force), []);
	const [wishlist] = useAsync((force) => loadWishlist(steamid, force), [steamid]);
	const [pill, setPillState] = useState(lastPill);
	const [sort, setSortState] = useState<SortId>(lastSort);
	const [want, setWantState] = useState(lastPages);
	const { deals, total, loading, error, loadedAll } = useSpecials(want, 0);

	const PILLS = pills();
	const filters = (PILLS.find((p) => p.id === pill) || PILLS[0]).filters;
	const visible = useMemo(() => filterDeals(deals, filters, sort, own), [deals, filters, sort, own]);
	const onSale = useMemo(() => wishlistOnSale(wishlist.data), [wishlist.data]);

	// Focus de départ : le dernier jeu choisi (retour depuis le magasin de Steam), sinon le premier souhait en promo
	const keys = [...onSale.map((d) => `w:${d.appid}`), ...visible.map((d) => `d:${d.appid}`)];
	// Après un tri depuis la grille, le focus va sur la première promo (sinon il se perdait avec la carte déplacée)
	const focusKey = focusFirstDeal && visible.length ? `d:${visible[0].appid}` : keys.includes(lastFocus) ? lastFocus : keys[0] || '';
	focusFirstDeal = false;

	const setPill = (id: string) => setPillState((lastPill = id));
	const nextSort = () => {
		const i = SORTS.findIndex((x) => x.id === sort);
		focusFirstDeal = !!bpWindow()?.document?.querySelector('.spbp-deal.gpfocus');
		setSortState((lastSort = SORTS[(i + 1) % SORTS.length].id));
	};
	const sortLabel = (SORTS.find((x) => x.id === sort)?.label || '').toLowerCase();
	const wl = wishlist.data;

	return (
		<BpFrame
			tab="store"
			onBack={goBackBp}
			options={{ label: 'Trier', run: nextSort }}
			secondary={{ label: 'Tout le magasin Steam', run: () => openSteamWebBp('https://store.steampowered.com/') }}
			info={
				<span>
					{wl?.ok && !wl.empty ? `${plural(onSale.length, 'souhait en promo', 'souhaits en promo')} · ` : ''}
					{deals.length ? plural(visible.length, 'promo', 'promos') : 'Chargement des promos…'}
				</span>
			}
		>
			<Banner featured={featured.data} total={total} onSale={onSale} wl={wl} />

			<WishlistRow wishlist={wishlist} onSale={onSale} own={own} focusKey={focusKey} />

			<section aria-labelledby="spbp-deals" style={{ margin: '22px 0 0', display: 'flex', flexDirection: 'column', gap: 18, padding: '0 64px 40px' }}>
				<Focusable flow-children="row" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
					<h2 id="spbp-deals" className="spbp-h2" style={{ marginRight: 12 }}>
						Promos du moment
					</h2>
					{PILLS.map((p) => (
						<DialogButton key={p.id} className="spbp-pill" noFocusRing aria-pressed={p.id === pill} onClick={() => setPill(p.id)} onOKActionDescription="Filtrer">
							{p.label}
						</DialogButton>
					))}
					<span style={{ flex: 1 }} />
					<span style={{ fontSize: 19, color: 'var(--sp-muted)' }}>
						{deals.length ? `${plural(visible.length, 'promo', 'promos')} · tri : ${sortLabel}` : `tri : ${sortLabel}`}
					</span>
				</Focusable>

				{error && !deals.length ? (
					<Notice>Impossible de charger les promos ({error}).</Notice>
				) : !deals.length && loading ? (
					<div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 24 }}>
						{[0, 1, 2, 3, 4].map((i) => (
							<span key={i} style={{ height: 230, borderRadius: 20, background: 'var(--sp-surface2)', opacity: 0.5 - i * 0.07 }} />
						))}
					</div>
				) : !visible.length ? (
					<p style={{ margin: 0, fontSize: 22, color: 'var(--sp-muted)' }}>Aucune promo chargée ne correspond à ce filtre.</p>
				) : (
					// remontée à chaque tri : les cartes ne sont pas déplacées sous le focus et autoFocus s'applique
					<Focusable key={sort} flow-children="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '30px 24px', paddingTop: 8 }}>
						{visible.map((d) => (
							<DealCard key={d.appid} d={d} focus={`d:${d.appid}` === focusKey} />
						))}
					</Focusable>
				)}

				{deals.length > 0 && !loadedAll && (
					<div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
						<DialogButton
							className="spbp-btn"
							noFocusRing
							disabled={loading}
							onClick={() => setWantState((lastPages = want + 1))}
							onOKActionDescription="Charger"
						>
							{loading ? 'Chargement…' : `Charger ${PAGE} promos de plus`}
						</DialogButton>
					</div>
				)}
			</section>
		</BpFrame>
	);
}
