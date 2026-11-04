// Composants de la page Magasin : icônes, capsule, prix, badges, popovers (filtres, tri).
import { ReactNode, RefObject, useEffect, useRef, useState } from 'react';
import { capitalize, Deal, money, moneyRound, int, Owned, priceSteps, reviewScore, reviewTone } from './data';

const svg = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const IconFilter = () => (
	<svg width={16} height={16} viewBox="0 0 24 24" aria-hidden="true" {...svg}>
		<path d="M4 6h16M7 12h10M10 18h4" />
	</svg>
);
export const IconChevron = () => (
	<svg width={14} height={14} viewBox="0 0 24 24" aria-hidden="true" {...svg}>
		<path d="M6 9l6 6 6-6" />
	</svg>
);
export const IconClose = ({ size = 12 }: { size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...svg} strokeWidth={2.4}>
		<path d="M6 6l12 12M18 6L6 18" />
	</svg>
);
export const IconCheck = () => (
	<svg width={16} height={16} viewBox="0 0 24 24" aria-hidden="true" {...svg} strokeWidth={2.4}>
		<path d="M5 12.5l4.5 4.5L19 7.5" />
	</svg>
);
export const IconSort = () => (
	<svg width={16} height={16} viewBox="0 0 24 24" aria-hidden="true" {...svg}>
		<path d="M7 4v16M3.5 16.5L7 20l3.5-3.5M17 20V4M13.5 7.5L17 4l3.5 3.5" />
	</svg>
);
export const IconExternal = () => (
	<svg width={15} height={15} viewBox="0 0 24 24" aria-hidden="true" {...svg}>
		<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
	</svg>
);
export const IconRefresh = () => (
	<svg width={16} height={16} viewBox="0 0 24 24" aria-hidden="true" {...svg}>
		<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
	</svg>
);
export const IconHeart = ({ on = false, size = 16 }: { on?: boolean; size?: number }) => (
	// var() ne marche pas dans un attribut SVG : couleurs en style
	<svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="2" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', fill: on ? 'currentColor' : 'none', stroke: 'currentColor' }}>
		<path d="M12 20.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.9c0 5.6-7.5 10-7.5 10z" />
	</svg>
);
export const IconCart = ({ size = 16 }: { size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...svg}>
		<path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2" />
		<circle cx="9.5" cy="19.5" r="1.3" />
		<circle cx="17" cy="19.5" r="1.3" />
	</svg>
);
export const IconTrash = ({ size = 16 }: { size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...svg}>
		<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9l1-12.5" />
	</svg>
);
export const IconPlus = ({ size = 16 }: { size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...svg}>
		<path d="M12 5v14M5 12h14" />
	</svg>
);
export const IconGift = ({ size = 13 }: { size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...svg}>
		<path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0" />
	</svg>
);
export const IconPerson = ({ size = 13 }: { size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...svg}>
		<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20a7 7 0 0 1 14 0" />
	</svg>
);

/** Petit compteur posé dans un bouton (liste de souhaits, panier). */
export function CountBadge({ n, strong }: { n: number; strong?: boolean }) {
	return (
		<span
			style={{ minWidth: 20, height: 20, padding: '0 6px', boxSizing: 'border-box', borderRadius: 10, fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: strong ? 'var(--sp-accent)' : 'var(--sp-bg)', color: strong ? 'var(--sp-accent-ink)' : 'var(--sp-text)' }}
		>
			{int(n)}
		</span>
	);
}

export const IconTag = () => (
	<svg width={22} height={22} viewBox="0 0 24 24" aria-hidden="true" {...svg}>
		<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.7 6.7a1.4 1.4 0 0 1-2 0z" />
		<circle cx="8.2" cy="8.2" r="1.6" />
	</svg>
);

// ---------- Capsule : aucune info posée dessus (règle produit) ----------

export function Capsule({ deal, width, radius = 'var(--sp-r-sm)' }: { deal: Deal; width?: number | string; radius?: string }) {
	const sources = [deal.header, deal.capsule, `https://shared.steamstatic.com/store_item_assets/steam/apps/${deal.appid}/header.jpg`].filter(Boolean) as string[];
	const [i, setI] = useState(0);
	return (
		<div style={{ width: width ?? '100%', aspectRatio: '460 / 215', borderRadius: radius, overflow: 'hidden', background: 'var(--sp-surface2)', flex: 'none' }}>
			{i < sources.length && (
				<img
					src={sources[i]}
					alt=""
					loading="lazy"
					draggable={false}
					onError={() => setI((n) => n + 1)}
					style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
				/>
			)}
		</div>
	);
}

// ---------- Prix et badges ----------

export function DiscountBadge({ pct, big }: { pct: number; big?: boolean }) {
	return (
		<span className="sp-badge" style={{ background: 'var(--sp-deal)', color: 'var(--sp-deal-ink)', fontSize: big ? 14 : 12, padding: big ? '5px 9px' : '3px 7px' }}>
			−{pct}&#8239;%
		</span>
	);
}

export function Prices({ deal, align = 'end' }: { deal: Deal; align?: 'start' | 'end' }) {
	if (deal.final == null) return <span className="sp-muted" style={{ fontSize: 13 }}>Prix indisponible</span>;
	const showOld = deal.discount > 0 && deal.original != null && deal.original > deal.final;
	return (
		<span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: align === 'end' ? 'flex-end' : 'flex-start', lineHeight: 1.15 }}>
			{showOld && <s className="sp-muted" style={{ fontSize: 12 }}>{money(deal.original)}</s>}
			<span style={{ fontWeight: 800, fontSize: 16 }}>{deal.final === 0 ? 'Gratuit' : money(deal.final)}</span>
		</span>
	);
}

export function OwnedBadge({ owned }: { owned?: Owned }) {
	if (!owned) return null;
	if (owned.kind === 'me')
		return (
			<span className="sp-badge" style={{ background: 'var(--sp-surface2)', color: 'var(--sp-text)', border: '1px solid var(--sp-line)' }}>
				Déjà à vous
			</span>
		);
	const m = owned.member;
	return (
		<span className="sp-badge" style={{ background: 'var(--sp-surface2)', color: 'var(--sp-text)', border: '1px solid var(--sp-line)' }}>
			<i aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
			{m.name} l'a déjà
		</span>
	);
}

/** Emplacement prévu pour le plus bas historique : n'apparaît qu'avec une donnée réelle. */
export function HistoricalLowBadge({ deal }: { deal: Deal }) {
	if (deal.historicalLow == null || deal.final == null || deal.final > deal.historicalLow) return null;
	return (
		<span className="sp-badge" style={{ background: 'transparent', color: 'var(--sp-deal)', border: '1px solid var(--sp-deal)' }}>
			Plus bas historique
		</span>
	);
}

export function Review({ deal }: { deal: Deal }) {
	const score = reviewScore(deal);
	if (!deal.reviewLabel) return <span className="sp-muted" style={{ fontSize: 12 }}>Pas encore d'évaluations</span>;
	return (
		<span style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
			<i aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: reviewTone(score), display: 'inline-block' }} />
			<span style={{ color: reviewTone(score), fontWeight: 700 }}>{capitalize(deal.reviewLabel)}</span>
			{deal.reviewPct != null && (
				<span className="sp-muted">
					{deal.reviewPct}&#8239;%{deal.reviewCount ? ` · ${int(deal.reviewCount)} avis` : ''}
				</span>
			)}
		</span>
	);
}

// ---------- Popover ancré sous un bouton (portail dans la fenêtre principale) ----------

export function usePopover(btn: RefObject<HTMLElement | null>, pop: RefObject<HTMLElement | null>) {
	const [open, setOpen] = useState(false);
	const [pos, setPos] = useState({ top: 0, left: 0, right: 0 });
	useEffect(() => {
		if (!open) return undefined;
		const doc = btn.current?.ownerDocument;
		const win = doc?.defaultView;
		const onDown = (e: MouseEvent) => {
			const t = e.target as Node;
			if (!pop.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
		const close = () => setOpen(false);
		const root = btn.current?.closest('.sp-root');
		doc?.addEventListener('mousedown', onDown, true);
		doc?.addEventListener('keydown', onKey);
		win?.addEventListener('blur', close);
		win?.addEventListener('resize', close);
		root?.addEventListener('scroll', close);
		return () => {
			doc?.removeEventListener('mousedown', onDown, true);
			doc?.removeEventListener('keydown', onKey);
			win?.removeEventListener('blur', close);
			win?.removeEventListener('resize', close);
			root?.removeEventListener('scroll', close);
		};
	}, [open]);
	const toggle = () => {
		const el = btn.current;
		if (!el) return;
		const r = el.getBoundingClientRect();
		const W = el.ownerDocument.defaultView?.innerWidth || 0;
		setPos({ top: r.bottom + 8, left: r.left, right: W - r.right });
		setOpen((o) => !o);
	};
	return { open, setOpen, pos, toggle };
}

export function Portal({ anchor, children }: { anchor: RefObject<HTMLElement | null>; children: ReactNode }) {
	const body = anchor.current?.ownerDocument?.body;
	return body ? (window as any).SP_REACTDOM.createPortal(children, body) : null;
}

// ---------- Filtres ----------

export type Filters = { minDiscount: number; maxPrice: number; hideOwned: boolean; positive: boolean };
export const NO_FILTERS: Filters = { minDiscount: 0, maxPrice: 0, hideOwned: false, positive: false };

export function activeFilters(f: Filters): { key: keyof Filters; label: string }[] {
	const out: { key: keyof Filters; label: string }[] = [];
	if (f.minDiscount) out.push({ key: 'minDiscount', label: `−${f.minDiscount} % et plus` });
	if (f.maxPrice) out.push({ key: 'maxPrice', label: `${moneyRound(f.maxPrice)} max.` });
	if (f.hideOwned) out.push({ key: 'hideOwned', label: 'Sans mes jeux ni ceux de la famille' });
	if (f.positive) out.push({ key: 'positive', label: 'Avis positifs et plus' });
	return out;
}

function Segmented({ label, value, options, onChange }: { label: string; value: number; options: { v: number; label: string }[]; onChange: (v: number) => void }) {
	return (
		<div role="radiogroup" aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
			<span className="sp-label">{label}</span>
			<div style={{ display: 'flex', gap: 6 }}>
				{options.map((o) => (
					<button
						key={o.v}
						type="button"
						role="radio"
						aria-checked={value === o.v}
						className="sp-pill"
						onClick={() => onChange(o.v)}
						style={{
							flex: 1,
							justifyContent: 'center',
							alignItems: 'center',
							padding: '0 6px',
							...(value === o.v ? { borderColor: 'var(--sp-accent)', background: 'var(--sp-surface2)', fontWeight: 700 } : null),
						}}
					>
						{o.label}
					</button>
				))}
			</div>
		</div>
	);
}

function Toggle({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
	return (
		<button type="button" role="switch" aria-checked={checked} className="sp-pop-item" onClick={() => onChange(!checked)} style={{ alignItems: 'center', padding: '8px 6px' }}>
			<span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
				<span style={{ fontWeight: 600 }}>{label}</span>
				{sub && <span className="sp-muted" style={{ fontSize: 12 }}>{sub}</span>}
			</span>
			<span aria-hidden="true" style={{ width: 36, height: 20, borderRadius: 10, flex: 'none', background: checked ? 'var(--sp-accent)' : 'var(--sp-surface2)', border: '1px solid var(--sp-line)', position: 'relative', transition: 'background .15s' }}>
				<i style={{ position: 'absolute', top: 2, left: checked ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: checked ? 'var(--sp-accent-ink)' : 'var(--sp-muted)', transition: 'left .15s' }} />
			</span>
		</button>
	);
}

export function FilterPill({ value, onChange }: { value: Filters; onChange: (f: Filters) => void }) {
	const btn = useRef<HTMLButtonElement>(null);
	const pop = useRef<HTMLDivElement>(null);
	const { open, pos, toggle } = usePopover(btn, pop);
	const n = activeFilters(value).length;
	const set = (p: Partial<Filters>) => onChange({ ...value, ...p });
	const steps = priceSteps();
	return (
		<>
			<button ref={btn} type="button" className="sp-pill" aria-haspopup="dialog" aria-expanded={open} aria-pressed={n > 0} onClick={toggle} style={{ alignItems: 'center', fontWeight: 700 }}>
				<IconFilter />
				Filtres
				{n > 0 && (
					<span aria-label={`${n} actifs`} style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: 'var(--sp-accent)', color: 'var(--sp-accent-ink)', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
						{n}
					</span>
				)}
				<IconChevron />
			</button>
			{open && (
				<Portal anchor={btn}>
					<div ref={pop} className="sp-pop" role="dialog" aria-label="Filtres des promos" style={{ top: pos.top, left: pos.left, width: 360, padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
						<Segmented
							label="Réduction minimale"
							value={value.minDiscount}
							onChange={(v) => set({ minDiscount: v })}
							options={[{ v: 0, label: 'Toutes' }, { v: 25, label: '−25 %' }, { v: 50, label: '−50 %' }, { v: 75, label: '−75 %' }]}
						/>
						{/* Paliers selon la devise du magasin ; absents pour une devise non prévue */}
						{steps && (
							<Segmented
								label="Prix maximum"
								value={value.maxPrice}
								onChange={(v) => set({ maxPrice: v })}
								options={[{ v: 0, label: 'Tous' }, ...steps.map((v) => ({ v, label: moneyRound(v) }))]}
							/>
						)}
						<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
							<Toggle label="Masquer ce que j'ai ou que la famille a" checked={value.hideOwned} onChange={(v) => set({ hideOwned: v })} />
							<Toggle label="Avis positifs et plus" sub="Positives, très ou extrêmement positives" checked={value.positive} onChange={(v) => set({ positive: v })} />
						</div>
						{n > 0 && (
							<button type="button" className="sp-btn" onClick={() => onChange(NO_FILTERS)} style={{ alignItems: 'center', height: 34 }}>
								Réinitialiser les filtres
							</button>
						)}
					</div>
				</Portal>
			)}
		</>
	);
}

export function FilterChips({ value, onChange }: { value: Filters; onChange: (f: Filters) => void }) {
	return (
		<>
			{activeFilters(value).map((a) => (
				<span key={a.key} className="sp-badge" style={{ height: 28, padding: '0 4px 0 10px', borderRadius: 14, background: 'var(--sp-surface2)', color: 'var(--sp-text)', border: '1px solid var(--sp-line)', fontWeight: 600, fontSize: 12 }}>
					{a.label}
					<button
						type="button"
						aria-label={`Retirer le filtre « ${a.label} »`}
						onClick={() => onChange({ ...value, [a.key]: NO_FILTERS[a.key] })}
						style={{ width: 20, height: 20, border: 0, borderRadius: 10, background: 'transparent', color: 'var(--sp-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
					>
						<IconClose />
					</button>
				</span>
			))}
		</>
	);
}

// ---------- Tri ----------

export type SortId = 'relevance' | 'discount' | 'price' | 'reviews';
export const SORTS: { id: SortId; label: string }[] = [
	{ id: 'relevance', label: 'Pertinence Steam' },
	{ id: 'discount', label: 'Meilleure réduction' },
	{ id: 'price', label: 'Prix croissant' },
	{ id: 'reviews', label: 'Meilleurs avis' },
];

/** Menu de tri ; `options` remplace les tris des promos (liste de souhaits). */
export function SortMenu<T extends string = SortId>({ value, onChange, options }: { value: T; onChange: (s: T) => void; options?: { id: T; label: string }[] }) {
	const list = options || (SORTS as unknown as { id: T; label: string }[]);
	const btn = useRef<HTMLButtonElement>(null);
	const pop = useRef<HTMLDivElement>(null);
	const { open, setOpen, pos, toggle } = usePopover(btn, pop);
	return (
		<>
			<button ref={btn} type="button" className="sp-pill" aria-haspopup="menu" aria-expanded={open} onClick={toggle} style={{ alignItems: 'center' }}>
				<IconSort />
				<span>
					<span className="sp-muted">Trier : </span>
					<b>{list.find((s) => s.id === value)?.label}</b>
				</span>
				<IconChevron />
			</button>
			{open && (
				<Portal anchor={btn}>
					<div ref={pop} className="sp-pop" role="menu" aria-label="Trier par" style={{ top: pos.top, right: pos.right, minWidth: 230 }}>
						{list.map((s) => (
							<button
								key={s.id}
								type="button"
								role="menuitemradio"
								aria-checked={s.id === value}
								className="sp-pop-item"
								style={{ alignItems: 'center' }}
								onClick={() => {
									onChange(s.id);
									setOpen(false);
								}}
							>
								<span style={{ flex: 1 }}>{s.label}</span>
								{s.id === value && (
									<span style={{ color: 'var(--sp-accent)', display: 'inline-flex' }}>
										<IconCheck />
									</span>
								)}
							</button>
						))}
					</div>
				</Portal>
			)}
		</>
	);
}
