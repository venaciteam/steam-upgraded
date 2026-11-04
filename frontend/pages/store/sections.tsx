// Sections de la page Magasin : bandeau, liste de souhaits en promo, promos du moment.
import { ReactNode, useLayoutEffect, useRef } from 'react';
import { beforeNextFrame } from '../../core/transitions';
import { navigate, openSteamWeb, openStorePage, ROUTES } from '../../core/steam';
import { Async, capitalize, Deal, endDate, money, Featured, int, loadWishlist, mySteamId, Owned, plural, saleSubject, Spotlight, useAsync, Wishlist } from './data';
import { useCart } from './cart';
import { Capsule, CountBadge, DiscountBadge, HistoricalLowBadge, IconCart, IconExternal, IconHeart, IconTag, OwnedBadge, Prices, Review } from './ui';

export function SectionHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
	return (
		<div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
			<div style={{ flex: 1, minWidth: 240 }}>
				<h2 className="sp-h2">{title}</h2>
				{sub && <div className="sp-muted" style={{ fontSize: 13, marginTop: 3 }}>{sub}</div>}
			</div>
			{children}
		</div>
	);
}

export function Notice({ children, action }: { children: ReactNode; action?: ReactNode }) {
	return (
		<div className="sp-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
			<div className="sp-muted" style={{ flex: 1 }}>{children}</div>
			{action}
		</div>
	);
}

export function Skeleton({ h, n = 1, gap = 10 }: { h: number; n?: number; gap?: number }) {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap }} aria-hidden="true">
			{Array.from({ length: n }, (_, i) => (
				<div key={i} className="sp-card" style={{ height: h, opacity: 0.55 - i * 0.07 }} />
			))}
		</div>
	);
}

// ---------- Bandeau ----------

// Grandes soldes et festivals thématiques (« Soldes d'automne Steam », « Festival de la course »…)
const SEASONAL = /soldes|festival/i;

/** Carte d'un évènement promo du magasin (soldes, promo éditeur, franchise…). */
function EventCard({ s, big }: { s: Spotlight; big?: boolean }) {
	const who = saleSubject(s.url);
	return (
		<button
			type="button"
			className="sps-hover"
			onClick={() => openSteamWeb(s.url)}
			title={s.url}
			style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: 8, minWidth: 0, borderRadius: 'var(--sp-r-md)', border: '1px solid var(--sp-line)', background: 'var(--sp-bg)', textAlign: 'left' }}
		>
			{s.image ? (
				<img src={s.image} alt="" loading="lazy" style={{ width: '100%', aspectRatio: big ? '2.4 / 1' : '2.1 / 1', objectFit: 'cover', borderRadius: 'var(--sp-r-sm)', display: 'block', background: 'var(--sp-surface2)' }} />
			) : (
				<span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', aspectRatio: big ? '2.4 / 1' : '2.1 / 1', borderRadius: 'var(--sp-r-sm)', background: 'var(--sp-surface2)', color: 'var(--sp-deal)' }}>
					<IconTag />
				</span>
			)}
			<span style={{ padding: '0 4px 2px', display: 'flex', flexDirection: 'column', gap: 2 }}>
				<span style={{ fontWeight: 800, fontSize: big ? 17 : 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{capitalize(s.name.toLowerCase())}</span>
				{who && <span className="sp-muted" style={{ fontSize: 12 }}>{who}</span>}
			</span>
		</button>
	);
}

/** Bandeau des promotions en cours sur Steam (évènements, offre du jour). La liste de souhaits a sa propre section. */
export function Banner({ featured, own, total }: { featured: Async<Featured>; own: Map<number, Owned>; total: number }) {
	const f = featured.data;
	const spot = f?.spotlights || [];
	// Grandes soldes ou festival en tête, puis les autres promos (éditeur, franchise…)
	const seasonal = spot.find((s) => SEASONAL.test(s.name));
	const events = [...(seasonal ? [seasonal] : []), ...spot.filter((s) => s !== seasonal && /\/sale\//.test(s.url))].slice(0, 4);
	const daily = f?.daily;

	return (
		<section aria-labelledby="sps-now" className="sp-card" style={{ padding: 20, display: 'flex', gap: 20, alignItems: 'stretch', flexWrap: 'wrap' }}>
			<div style={{ flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 14 }}>
				<div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
					<div style={{ flex: 1, minWidth: 220 }}>
						<span className="sp-label" style={{ color: 'var(--sp-deal)' }}>{seasonal ? 'Soldes en cours' : 'Promotions en cours'}</span>
						<h2 id="sps-now" className="sp-h2" style={{ marginTop: 4 }}>
							{seasonal ? capitalize(seasonal.name.toLowerCase()) : events.length ? 'Les promos du moment sur Steam' : 'Pas d’évènement promo en ce moment'}
						</h2>
						{total > 0 && <div className="sp-muted" style={{ fontSize: 13, marginTop: 2 }}>{int(total)} jeux et contenus en promo sur Steam</div>}
					</div>
					<a role="button" tabIndex={0} onClick={() => openSteamWeb('https://store.steampowered.com/specials/')}>
						Toutes les promos sur Steam
					</a>
				</div>
				{featured.loading && !f ? (
					<Skeleton h={120} />
				) : events.length > 0 ? (
					<div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(events.length, 3)}, minmax(0, 1fr))`, gap: 12 }}>
						{events.slice(0, 3).map((s, i) => (
							<EventCard key={s.url} s={s} big={i === 0 && !!seasonal} />
						))}
					</div>
				) : (
					<div className="sp-muted" style={{ fontSize: 13 }}>Steam ne met aucun évènement en avant aujourd'hui : les promos du moment sont listées plus bas.</div>
				)}
			</div>
			{daily && daily.appid && (
				<button
					type="button"
					className="sps-hover"
					onClick={() => openStorePage(daily.appid)}
					aria-label={`Offre du jour : ${daily.name || ''}`}
					style={{ width: 300, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: 10, borderRadius: 'var(--sp-r-md)', border: '1px solid var(--sp-line)', background: 'var(--sp-bg)', textAlign: 'left' }}
				>
					<span className="sp-label">Offre du jour</span>
					<Capsule deal={daily} />
					<span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{daily.name}</span>
					<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						{daily.discount > 0 && <DiscountBadge pct={daily.discount} />}
						<OwnedBadge owned={own.get(daily.appid)} />
						<span style={{ flex: 1 }} />
						<Prices deal={daily} />
					</span>
				</button>
			)}
		</section>
	);
}

// ---------- Liste de souhaits en promo ----------

export function WishCard({ deal, owned }: { deal: Deal; owned?: Owned }) {
	const end = endDate(deal.discountEnd);
	return (
		<button
			type="button"
			className="sps-card sps-hover"
			onClick={() => openStorePage(deal.appid)}
			style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10, textAlign: 'left', borderRadius: 'var(--sp-r-lg)', border: '1px solid var(--sp-line)', background: 'var(--sp-surface)', minWidth: 0 }}
		>
			<Capsule deal={deal} radius="var(--sp-r-md)" />
			<div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
				<span style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={deal.name}>
					{deal.name || `Jeu ${deal.appid}`}
				</span>
				{(owned || deal.historicalLow != null) && (
					<span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
						<OwnedBadge owned={owned} />
						<HistoricalLowBadge deal={deal} />
					</span>
				)}
				<span style={{ flex: 1 }} />
				<span style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
					<DiscountBadge pct={deal.discount} big />
					<span className="sp-muted" style={{ fontSize: 11, flex: 1, paddingBottom: 2 }}>{end}</span>
					<Prices deal={deal} />
				</span>
			</div>
		</button>
	);
}

export function WishlistSection({ wishlist, onSale, own, retry }: { wishlist: Async<Wishlist>; onSale: Deal[]; own: Map<number, Owned>; retry: () => void }) {
	const wl = wishlist.data;
	const rest = wl ? wl.count - onSale.length : 0;
	const save = onSale.reduce((n, d) => n + Math.max(0, (d.original ?? 0) - (d.final ?? 0)), 0);
	const pay = onSale.reduce((n, d) => n + (d.final ?? 0), 0);
	return (
		<section aria-label="Votre liste de souhaits en promo">
			<SectionHead
				title="Votre liste de souhaits en promo"
				sub={
					wl && !wl.empty ? (
						<>
							{plural(onSale.length, 'jeu en promo', 'jeux en promo')} sur {plural(wl.count, 'souhait', 'souhaits')}
							{rest > 0 ? ` · ${int(rest)} au prix normal` : ''}
							{save > 0 && (
								<>
									{' · '}
									<b style={{ color: 'var(--sp-deal)' }}>{money(save)} d'économie</b> pour {onSale.length === 1 ? 'ce jeu' : 'l’ensemble des jeux en promo'} ({money(pay)} au lieu de {money(pay + save)})
								</>
							)}
						</>
					) : undefined
				}
			>
				{wl && !wl.empty && (
					<a role="button" tabIndex={0} onClick={() => navigate(ROUTES.wishlist)}>
						Toute la liste ({int(wl.count)})
					</a>
				)}
			</SectionHead>
			{wishlist.loading && !wl ? (
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14 }} aria-hidden="true">
					{[0, 1, 2, 3].map((i) => (
						<div key={i} className="sp-card" style={{ height: 230, opacity: 0.5 }} />
					))}
				</div>
			) : wishlist.error ? (
				<Notice action={<button type="button" className="sp-btn" onClick={retry} style={{ alignItems: 'center' }}>Réessayer</button>}>
					Impossible de lire votre liste de souhaits ({wishlist.error}).
				</Notice>
			) : !wl || wl.empty ? (
				<Notice>Votre liste de souhaits est vide ou privée : rien à surveiller ici pour l'instant.</Notice>
			) : !onSale.length ? (
				<Notice>Aucun jeu de votre liste de souhaits n'est en promo pour le moment.</Notice>
			) : (
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14 }}>
					{onSale.map((d) => (
						<WishCard key={d.appid} deal={d} owned={own.get(d.appid)} />
					))}
				</div>
			)}
		</section>
	);
}

// ---------- Promos du moment ----------

export function DealRow({ deal, owned }: { deal: Deal; owned?: Owned }) {
	const end = endDate(deal.discountEnd);
	return (
		<button
			type="button"
			className="sps-row sps-hover"
			onClick={() => openStorePage(deal.appid)}
			style={{ display: 'grid', gridTemplateColumns: '168px minmax(0, 1fr) auto', alignItems: 'center', gap: 16, width: '100%', padding: 8, paddingRight: 16, textAlign: 'left', borderRadius: 'var(--sp-r-md)', border: '1px solid transparent', background: 'transparent' }}
		>
			<Capsule deal={deal} width={168} />
			<span style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
				<span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
					<span style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.name || `Jeu ${deal.appid}`}</span>
					<OwnedBadge owned={owned} />
					<HistoricalLowBadge deal={deal} />
				</span>
				{deal.tags && deal.tags.length > 0 && (
					<span className="sp-muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.tags.join(' · ')}</span>
				)}
				<Review deal={deal} />
			</span>
			<span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
				{end && <span className="sp-muted" style={{ fontSize: 11 }}>{end}</span>}
				<DiscountBadge pct={deal.discount} big />
				<span style={{ minWidth: 72, display: 'inline-flex', justifyContent: 'flex-end' }}>
					<Prices deal={deal} />
				</span>
			</span>
		</button>
	);
}

type StoreTab = 'store' | 'wishlist' | 'cart';

// Onglet du sélecteur affiché sur la page précédente : la pastille part de là et glisse jusqu'au nouvel onglet
let lastTab: StoreTab | null = null;

/**
 * Sélecteur Promos / Liste de souhaits / Panier, tout à droite de l'en-tête des trois pages (donc toujours au même endroit).
 * Sa pastille glisse d'un onglet à l'autre d'une page à la suivante ; la page change en fondu (core/transitions.ts).
 */
export function StoreTabs({ current }: { current: StoreTab }) {
	const [wl] = useAsync((force) => loadWishlist(mySteamId(), force), []);
	const { cart } = useCart();
	const tabs: { id: StoreTab; label: string; icon?: ReactNode; count?: number; go: string }[] = [
		{ id: 'store', label: 'Promos', go: ROUTES.store },
		{ id: 'wishlist', label: 'Liste de souhaits', icon: <IconHeart />, count: wl.data?.count, go: ROUTES.wishlist },
		{ id: 'cart', label: 'Panier', icon: <IconCart />, count: cart?.lines.length, go: ROUTES.cart },
	];
	const index = tabs.findIndex((t) => t.id === current);
	const navRef = useRef<HTMLElement>(null);
	const indRef = useRef<HTMLSpanElement>(null);
	useLayoutEffect(() => {
		const nav = navRef.current;
		const ind = indRef.current;
		if (!nav || !ind) return undefined;
		const place = (i: number) => {
			const btn = nav.children[i + 1] as HTMLElement | undefined;
			if (!btn) return;
			ind.style.transform = `translateX(${btn.offsetLeft}px)`;
			ind.style.width = `${btn.offsetWidth}px`;
			ind.style.opacity = '1';
		};
		const from = lastTab ? tabs.findIndex((t) => t.id === lastTab) : -1;
		lastTab = current;
		// Juste avant l'image suivante, pas pendant le changement de page (mise en page forcée, voir core/transitions.ts)
		const win = nav.ownerDocument.defaultView;
		const stop = beforeNextFrame(win, () => {
			place(from >= 0 ? from : index);
			beforeNextFrame(win, () => {
				nav.classList.add('sps-tabs--ready');
				place(index);
			});
		});
		const ro = win ? new (win as any).ResizeObserver(() => place(index)) : null;
		ro?.observe(nav);
		return () => {
			stop();
			ro?.disconnect();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [index]);
	return (
		<nav aria-label="Pages du magasin" className="sps-tabs" ref={navRef}>
			<span className="sps-tabs-ind" ref={indRef} aria-hidden="true" />
			{tabs.map((t) => (
				<button key={t.id} type="button" aria-current={t.id === current ? 'page' : undefined} onClick={() => t.id !== current && navigate(t.go)}>
					{t.icon}
					{t.label}
					{t.count != null && <CountBadge n={t.count} strong={t.id === 'cart' && t.count > 0} />}
				</button>
			))}
		</nav>
	);
}

export function OpenFullStore() {
	return (
		<button type="button" className="sp-btn" onClick={() => openSteamWeb('https://store.steampowered.com/')} style={{ alignItems: 'center' }}>
			<IconExternal />
			Ouvrir le magasin Steam complet
		</button>
	);
}

export const STORE_CSS = `
/* Les pages à sélecteur gardent la place de la barre de défilement : le sélecteur ne bouge pas d'une page à l'autre */
.sps-page{scrollbar-gutter:stable;}
/* theme.ts force align-items:stretch sur les boutons de .sp-root */
.sps-page button{align-items:center;}
.sps-page button.sps-card{align-items:stretch;}
.sps-hover{transition:background .12s,border-color .12s;}
.sps-row:hover,.sps-row:focus-visible{background:var(--sp-surface) !important;border-color:var(--sp-line) !important;}
/* Contour de 2 px au survol : la bordure de 1 px plus une ombre pleine de 1 px (rien ne bouge) */
.sps-card:hover,.sps-card:focus-visible{border-color:var(--sp-accent) !important;box-shadow:0 0 0 1px var(--sp-accent);}
.sps-page button.sps-hover:not(.sps-row):not(.sps-card):hover{border-color:var(--sp-accent) !important;box-shadow:0 0 0 1px var(--sp-accent);}
.sps-page button:focus-visible{outline:2px solid var(--sp-accent);outline-offset:2px;}
/* Sélecteur Promos / Liste de souhaits / Panier : pastille glissante (StoreTabs) */
.sps-tabs{position:relative;display:flex;gap:2px;padding:4px;border-radius:var(--sp-r-md);background:var(--sp-surface);border:1px solid var(--sp-line);}
/* même graisse partout : la largeur des onglets ne change pas d'une page à l'autre, la pastille tombe juste */
.sps-page .sps-tabs button{position:relative;z-index:1;display:flex;align-items:center;gap:8px;height:36px;padding:0 12px 0 14px;border:0;border-radius:var(--sp-r-sm);background:transparent;color:var(--sp-muted);font-weight:700;white-space:nowrap;}
.sps-page .sps-tabs button:hover{color:var(--sp-text);}
.sps-page .sps-tabs button[aria-current]{color:var(--sp-text);cursor:default;}
.sps-tabs-ind{position:absolute;top:4px;left:0;height:36px;border-radius:var(--sp-r-sm);background:var(--sp-surface2);box-shadow:inset 0 0 0 1px var(--sp-accent);opacity:0;}
.sps-tabs--ready .sps-tabs-ind{transition:transform .26s cubic-bezier(.2,.8,.2,1),width .26s cubic-bezier(.2,.8,.2,1),opacity .2s;}
@media (prefers-reduced-motion:reduce){.sps-tabs--ready .sps-tabs-ind{transition:opacity .14s;}}
`;
