// Blocs de la page Bibliothèque : colonne de gauche, Reprendre, chiffres, menu de tri.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatLastPlayed, navigate, ROUTES } from '../../core/steam';
import { useArt } from '../../core/art';
import { Coll, formatBigHours, formatInt, Game, Library, NATIVE, NativeId, Person, plural, Selection, SORTS, SortId, VIEWS, ViewId } from './data';
import { Avatar, Dot, IconCheck, IconChevron, IconSort, PlayButton } from './ui';
import { openGameMenu } from './menu';
import { beforeNextFrame } from '../../core/transitions';

// ---------- Colonne de gauche ----------

export type SideCounts = { views: Record<ViewId, number>; colls: Map<string, number>; people: Map<number, number>; native: Record<NativeId, number> };

function same(a: Selection, b: Selection) {
	return a.kind === b.kind && a.id === b.id;
}

function SideItem({ active, onClick, count, children }: { active: boolean; onClick: () => void; count: number; children: any }) {
	return (
		<button type="button" className="spl-side" aria-current={active ? 'true' : undefined} onClick={onClick}>
			{children}
			<span className="spl-count">{formatInt(count)}</span>
		</button>
	);
}

/** Vues propres à la Famille Steam : masquées sans famille (toujours vides). */
const FAMILY_VIEWS: ViewId[] = ['borrowed', 'multi'];

export function Sidebar({ lib, counts, sel, onSelect }: { lib: Library; counts: SideCounts; sel: Selection; onSelect: (s: Selection) => void }) {
	const head = (t: string) => (
		<h2 className="sp-label" style={{ margin: '0 10px 6px' }}>
			{t}
		</h2>
	);
	// Pastille de la vue choisie : elle glisse d'une entrée à l'autre (placée sans animation la première fois)
	const asideRef = useRef<HTMLElement>(null);
	const indRef = useRef<HTMLSpanElement>(null);
	useLayoutEffect(() => {
		const aside = asideRef.current;
		const ind = indRef.current;
		if (!aside || !ind) return undefined;
		const place = () => {
			const btn = aside.querySelector<HTMLElement>('.spl-side[aria-current="true"]');
			if (btn) {
				ind.style.transform = `translateY(${btn.offsetTop}px)`;
				ind.style.height = `${btn.offsetHeight}px`;
			}
			ind.style.opacity = btn ? '1' : '0';
		};
		// Placée juste avant l'image suivante et non pendant le montage : y lire une position forcerait une mise en page
		// de toute la Bibliothèque en plus de celle du navigateur (voir core/transitions.ts)
		const win = aside.ownerDocument.defaultView;
		const stop = beforeNextFrame(win, () => {
			place();
			beforeNextFrame(win, () => aside.classList.add('spl-ind-ready'));
		});
		const ro = win ? new (win as any).ResizeObserver(place) : null;
		ro?.observe(aside);
		return () => {
			stop();
			ro?.disconnect();
		};
	}, [sel.kind, sel.id, lib]);
	return (
		<aside ref={asideRef} aria-label="Filtres de la bibliothèque" style={{ position: 'relative', width: 252, flex: 'none', borderRight: '1px solid var(--sp-line)', overflow: 'auto', padding: '26px 14px 32px', display: 'flex', flexDirection: 'column', gap: 26 }}>
			<span className="spl-side-ind" ref={indRef} aria-hidden="true" />
			<nav aria-label="Vues">
				{head('Vues')}
				{VIEWS.filter((v) => !FAMILY_VIEWS.includes(v.id) || lib.people.length > 1 || counts.views[v.id] > 0 || same(sel, { kind: 'view', id: v.id })).map((v) => {
					const s: Selection = { kind: 'view', id: v.id };
					return (
						<SideItem key={v.id} active={same(sel, s)} onClick={() => onSelect(s)} count={counts.views[v.id]}>
							{v.label}
						</SideItem>
					);
				})}
			</nav>

			{lib.collections.length > 0 && (
				<nav aria-label="Mes collections">
					{head('Mes collections')}
					{lib.collections.map((c: Coll) => {
						const s: Selection = { kind: 'coll', id: c.id };
						return (
							<SideItem key={c.id} active={same(sel, s)} onClick={() => onSelect(s)} count={counts.colls.get(c.id) || 0}>
								<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
							</SideItem>
						);
					})}
				</nav>
			)}

			{lib.people.length > 1 && (
				<nav aria-label="Famille Steam">
					{head('Famille Steam')}
					{lib.people.map((p: Person) => {
						const s: Selection = { kind: 'person', id: p.accountId };
						return (
							<SideItem key={p.accountId} active={same(sel, s)} onClick={() => onSelect(s)} count={counts.people.get(p.accountId) || 0}>
								<Avatar p={p} size={24} />
								<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.isMe ? 'Moi' : p.name}</span>
							</SideItem>
						);
					})}
				</nav>
			)}

			<nav aria-label="Autres">
				{head('Autres')}
				{NATIVE.filter((n) => n.id === 'hidden' || counts.native[n.id] > 0).map((n) => {
					const s: Selection = { kind: 'native', id: n.id };
					return (
						<SideItem key={n.id} active={same(sel, s)} onClick={() => onSelect(s)} count={counts.native[n.id]}>
							{n.label}
						</SideItem>
					);
				})}
			</nav>
		</aside>
	);
}

// ---------- Reprendre ----------

function ResumeCard({ g, onChanged }: { g: Game; onChanged: () => void }) {
	const landscape = useArt(g.app, 'header', g.landscape);
	const [broken, setBroken] = useState(false);
	useEffect(() => setBroken(false), [landscape]);
	const open = () => navigate(ROUTES.app(g.appid));
	return (
		<article className="sp-card spl-resume" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }} onContextMenu={(e) => openGameMenu(e, g, onChanged)}>
			<button type="button" className="spl-resume-img" onClick={open} aria-label={`Fiche du jeu : ${g.name}`} data-sp-appid={g.appid} data-sp-kind="resume">
				{broken ? (
					<span style={{ display: 'flex', alignItems: 'flex-end', aspectRatio: '460 / 215', padding: 16, fontWeight: 800, color: 'var(--sp-muted)' }}>{g.name}</span>
				) : (
					<img src={landscape} alt="" onError={() => setBroken(true)} />
				)}
			</button>
			<div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
				<div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
					<span style={{ fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</span>
					<span className="sp-muted" style={{ fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
						{formatLastPlayed(g.last)} · {formatBigHours(g.mins)} au total
					</span>
				</div>
				<PlayButton g={g} compact />
			</div>
		</article>
	);
}

export function Resume({ games, onChanged }: { games: Game[]; onChanged: () => void }) {
	if (!games.length) return null;
	return (
		<section aria-labelledby="spl-resume" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
			<h2 id="spl-resume" className="sp-h2" style={{ fontSize: 17 }}>
				Reprendre
			</h2>
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18 }}>
				{games.map((g) => (
					<ResumeCard key={g.appid} g={g} onChanged={onChanged} />
				))}
			</div>
		</section>
	);
}

// ---------- Bandeau de chiffres ----------

export type Stats = {
	mins2w: number;
	played2w: number;
	total: number;
	launched: number;
	never: number;
	count: number;
	borrowed: number;
	byLender: { p: Person; n: number }[];
};

function Stat({ label, value, sub, children, wide }: { label: string; value: string; sub?: string; children?: any; wide?: boolean }) {
	return (
		<div className="sp-card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4, gridColumn: wide ? 'span 2' : undefined, minWidth: 0 }}>
			<span className="sp-label">{label}</span>
			<div style={{ display: 'flex', alignItems: 'center', gap: 22, minWidth: 0 }}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 'none' }}>
					<span style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
					{sub && (
						<span className="sp-muted" style={{ fontSize: 12.5 }}>
							{sub}
						</span>
					)}
				</div>
				{children && <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>}
			</div>
		</div>
	);
}

export function StatsBand({ st }: { st: Stats }) {
	const pct = st.count ? Math.round((st.never / st.count) * 100) : 0;
	// Sans jeu prêté (pas de Famille Steam), pas de carte « Prêtés par la famille »
	const family = st.borrowed > 0;
	return (
		<section aria-label="Chiffres de la bibliothèque" style={{ display: 'grid', gridTemplateColumns: `repeat(${family ? 5 : 3}, minmax(0, 1fr))`, gap: 14 }}>
			<Stat label="Ces 2 semaines" value={formatBigHours(st.mins2w)} sub={st.played2w ? `sur ${plural(st.played2w, 'jeu', 'jeux')}` : 'aucune session'} />
			<Stat label="Temps total" value={formatBigHours(st.total)} sub={`sur ${plural(st.launched, 'jeu lancé', 'jeux lancés')}`} />
			<Stat label="Jamais lancés" value={formatInt(st.never)} sub={`${pct} % des ${plural(st.count, 'jeu', 'jeux')}`} />
			{family && (
				<Stat label="Prêtés par la famille" value={formatInt(st.borrowed)} sub={`${st.count ? Math.round((st.borrowed / st.count) * 100) : 0} % du total`} wide>
					<span aria-hidden="true" style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', gap: 2 }}>
						{st.byLender.map(({ p, n }) => (
							<span key={p.accountId} style={{ flex: n, background: p.color }} />
						))}
					</span>
					<span style={{ display: 'grid', gridTemplateColumns: 'repeat(2, max-content)', columnGap: 18, rowGap: 2, fontSize: 12.5, lineHeight: 1.35 }}>
						{st.byLender.map(({ p, n }) => (
							<span key={p.accountId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
								<Dot color={p.color} />
								<span>{p.name}</span>
								<span className="sp-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
									{n}
								</span>
							</span>
						))}
					</span>
				</Stat>
			)}
		</section>
	);
}

// ---------- Menu de tri ----------

export function SortMenu({ value, onChange }: { value: SortId; onChange: (s: SortId) => void }) {
	const [open, setOpen] = useState(false);
	const btn = useRef<HTMLButtonElement>(null);
	const pop = useRef<HTMLDivElement>(null);
	const [pos, setPos] = useState({ top: 0, right: 0 });

	useEffect(() => {
		if (!open) return undefined;
		const doc = btn.current?.ownerDocument;
		const win = doc?.defaultView;
		const onDown = (e: MouseEvent) => {
			const t = e.target as Node;
			if (!pop.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setOpen(false);
				btn.current?.focus();
			}
		};
		const onBlur = () => setOpen(false);
		doc?.addEventListener('mousedown', onDown, true);
		doc?.addEventListener('keydown', onKey);
		win?.addEventListener('blur', onBlur);
		win?.addEventListener('resize', onBlur);
		return () => {
			doc?.removeEventListener('mousedown', onDown, true);
			doc?.removeEventListener('keydown', onKey);
			win?.removeEventListener('blur', onBlur);
			win?.removeEventListener('resize', onBlur);
		};
	}, [open]);

	const toggle = () => {
		const el = btn.current;
		if (!el) return;
		const r = el.getBoundingClientRect();
		const W = el.ownerDocument.defaultView?.innerWidth || 0;
		setPos({ top: r.bottom + 6, right: W - r.right });
		setOpen((o) => !o);
	};

	const label = SORTS.find((s) => s.id === value)?.label;
	const body = btn.current?.ownerDocument?.body;
	return (
		<>
			<button ref={btn} type="button" className="sp-btn" aria-haspopup="menu" aria-expanded={open} onClick={toggle} style={{ flex: 'none', gap: 8, padding: '0 12px 0 14px' }}>
				<IconSort />
				<span>
					<span className="sp-muted" style={{ fontWeight: 500 }}>
						Trier :{' '}
					</span>
					{label}
				</span>
				<IconChevron />
			</button>
			{open &&
				body &&
				(window as any).SP_REACTDOM.createPortal(
					<div ref={pop} className="sp-pop spl-sortpop" role="menu" aria-label="Trier par" style={{ top: pos.top, right: pos.right, minWidth: 220 }}>
						{SORTS.map((s) => (
							<button
								key={s.id}
								type="button"
								role="menuitemradio"
								aria-checked={s.id === value}
								className="sp-pop-item"
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
					</div>,
					body,
				)}
		</>
	);
}
