// Big Picture › Succès d'un jeu (remplace /library/app/:appid/achievements) : progression en bannière,
// filtres (LB/RB), « Presque obtenus » avec leur progression, obtenus avec date et rareté. Y change le tri.
import { useEffect, useRef, useState } from 'react';
import { DialogButton, Focusable, GamepadButton } from 'millennium';
import { usePath } from '../core/history';
import { appById } from '../core/steam';
import { formatBigHours, plural } from '../pages/library/data';
import { isShortcut, useGame } from '../pages/game/data';
import { BpFrame, goBackBp, useClock } from './Frame';
import { HeroImage } from './gameActions';
import { Glyph, GLYPH } from './Glyph';

const w = window as any;

type Ach = {
	id: string;
	name: string;
	description: string;
	achieved: boolean;
	unlocked: number;
	image: string;
	hidden: boolean;
	/** Part des comptes qui l'ont obtenu (en %), -1 si inconnue. */
	rarity: number;
	progress: number;
	max: number;
};

type Filter = 'all' | 'got' | 'todo';
type Sort = 'auto' | 'rare' | 'name';

const FILTERS: { id: Filter; label: string }[] = [
	{ id: 'all', label: 'Tous' },
	{ id: 'got', label: 'Obtenus' },
	{ id: 'todo', label: 'À obtenir' },
];

const SORTS: { id: Sort; label: string }[] = [
	{ id: 'auto', label: 'Plus récents' },
	{ id: 'rare', label: 'Plus rares' },
	{ id: 'name', label: 'Nom' },
];

function useAllAchievements(appid: number): { list: Ach[] | null; loading: boolean } {
	const [state, set] = useState<{ list: Ach[] | null; loading: boolean }>({ list: null, loading: true });
	useEffect(() => {
		let alive = true;
		set({ list: null, loading: true });
		if (!appid || isShortcut(appid)) {
			set({ list: null, loading: false });
			return undefined;
		}
		(async () => {
			try {
				const r: any = await w.SteamClient.Apps.GetMyAchievementsForApp(String(appid));
				if (!alive) return;
				const raw: any[] = r?.result === 1 ? r?.data?.rgAchievements || [] : [];
				set({
					list: raw.map((a) => ({
						id: String(a.strID),
						name: a.strName || '',
						description: a.strDescription || '',
						achieved: !!a.bAchieved,
						unlocked: a.rtUnlocked || 0,
						image: a.strImage || '',
						hidden: !!a.bHidden,
						rarity: typeof a.flAchieved === 'number' ? a.flAchieved : -1,
						progress: Number(a.flCurrentProgress || 0),
						max: Number(a.flMaxProgress || 0),
					})),
					loading: false,
				});
			} catch (e) {
				console.error('[steam-upgraded] succès indisponibles', appid, e);
				if (alive) set({ list: null, loading: false });
			}
		})();
		return () => {
			alive = false;
		};
	}, [appid]);
	return state;
}

function pct(n: number): string {
	return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
}

function longDate(rt: number): string {
	return new Date(rt * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function sortList(list: Ach[], sort: Sort, got: boolean): Ach[] {
	const l = [...list];
	if (sort === 'name') return l.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
	if (sort === 'rare') return l.sort((a, b) => a.rarity - b.rarity);
	// par défaut : derniers obtenus d'abord ; à obtenir, les plus courants d'abord (les plus accessibles)
	return got ? l.sort((a, b) => b.unlocked - a.unlocked) : l.sort((a, b) => b.rarity - a.rarity);
}

/** Proche du but : progression connue et entamée. */
function isClose(a: Ach): boolean {
	return !a.achieved && a.max > 0 && a.progress > 0 && a.progress < a.max;
}

function AchCard({ a, revealed, onReveal, first }: { a: Ach; revealed: boolean; onReveal: () => void; first?: boolean }) {
	const secret = a.hidden && !a.achieved && !revealed;
	const sub = a.achieved
		? `${a.unlocked ? `${longDate(a.unlocked)} · ` : ''}${a.rarity >= 0 ? `obtenu par ${pct(a.rarity)} des comptes` : ''}`
		: a.rarity >= 0
			? `Obtenu par ${pct(a.rarity)} des comptes`
			: '';
	return (
		<DialogButton
			className={`spbp-ach${a.achieved ? '' : ' spbp-ach--todo'}`}
			noFocusRing
			autoFocus={first}
			onClick={secret ? onReveal : undefined}
			onOKActionDescription={secret ? 'Afficher la description' : undefined}
			aria-label={secret ? 'Succès caché' : a.name}
		>
			{a.image ? <img src={a.image} alt="" className="spbp-ach-img" loading="lazy" /> : <span className="spbp-ach-img" aria-hidden="true" />}
			<span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
				<span style={{ fontSize: 22, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{secret ? 'Succès caché' : a.name}</span>
				<span className="spbp-ach-desc">{secret ? 'Description masquée' : a.description}</span>
				{isClose(a) ? (
					<span style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
						<span className="spbp-bar" style={{ flex: 1, height: 8 }}>
							<i style={{ width: `${Math.round((a.progress / a.max) * 100)}%` }} />
						</span>
						<span style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
							{a.progress.toLocaleString('fr-FR')} / {a.max.toLocaleString('fr-FR')}
						</span>
					</span>
				) : (
					sub && <span style={{ fontSize: 16, color: 'var(--sp-muted)' }}>{sub}</span>
				)}
			</span>
		</DialogButton>
	);
}

function Section({ title, list, revealed, reveal, focusFirst }: { title: string; list: Ach[]; revealed: Set<string>; reveal: (id: string) => void; focusFirst: boolean }) {
	if (!list.length) return null;
	return (
		<section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
			<h2 className="spbp-h2" style={{ fontSize: 26 }}>
				{title}
			</h2>
			<Focusable flow-children="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px 24px' }}>
				{list.map((a, i) => (
					<AchCard key={a.id} a={a} revealed={revealed.has(a.id)} onReveal={() => reveal(a.id)} first={focusFirst && i === 0} />
				))}
			</Focusable>
		</section>
	);
}

export function BpAchievements() {
	const path = usePath('bp');
	const lastAppid = useRef(0);
	const fromPath = Number(path.match(/\/steamupgraded\/bp\/succes\/(\d+)/)?.[1] || 0);
	if (fromPath) lastAppid.current = fromPath;
	const appid = lastAppid.current;
	const { app } = useGame(appid);
	const { list, loading } = useAllAchievements(appid);
	const [filter, setFilter] = useState<Filter>('all');
	const [sort, setSort] = useState<Sort>('auto');
	const [revealed, setRevealed] = useState<Set<string>>(new Set());
	const clock = useClock();

	const name = app?.display_name || appById(appid)?.display_name || '';
	const got = (list || []).filter((a) => a.achieved);
	const todo = (list || []).filter((a) => !a.achieved);
	const total = list?.length || 0;
	const ratio = total ? Math.round((got.length / total) * 100) : 0;
	const close = sortList(todo.filter(isClose), 'auto', false)
		.sort((a, b) => b.progress / b.max - a.progress / a.max)
		.slice(0, 4);
	const closeIds = new Set(close.map((a) => a.id));
	const reveal = (id: string) => setRevealed((s) => new Set(s).add(id));
	const step = (d: number) => {
		const i = FILTERS.findIndex((f) => f.id === filter);
		const next = FILTERS[i + d];
		if (next) setFilter(next.id);
	};
	const onButtonDown = (e: any) => {
		const b = e?.detail?.button;
		if (b === GamepadButton.BUMPER_LEFT) step(-1);
		if (b === GamepadButton.BUMPER_RIGHT) step(1);
	};
	const sortLabel = SORTS.find((s) => s.id === sort)!.label;
	const nextSort = () => setSort((s) => SORTS[(SORTS.findIndex((x) => x.id === s) + 1) % SORTS.length].id);
	const counts: Record<Filter, number> = { all: total, got: got.length, todo: todo.length };
	const mins = Number(app?.minutes_playtime_forever || 0);

	const sections =
		filter === 'got'
			? [{ title: 'Obtenus', list: sortList(got, sort, true) }]
			: filter === 'todo'
				? [{ title: 'À obtenir', list: sortList(todo, sort, false) }]
				: [
						{ title: 'Presque obtenus', list: sort === 'auto' ? close : [] },
						{ title: 'Obtenus', list: sortList(got, sort, true) },
						{ title: 'À obtenir', list: sortList(sort === 'auto' ? todo.filter((a) => !closeIds.has(a.id)) : todo, sort, false) },
					];

	return (
		<BpFrame
			header={false}
			onBack={goBackBp}
			options={total ? { label: `Trier (${sortLabel.toLowerCase()})`, run: nextSort } : undefined}
			info={
				<span>
					{name} › Succès{mins ? ` · ${formatBigHours(mins)} de jeu` : ''}
				</span>
			}
		>
			<Focusable onButtonDown={onButtonDown} style={{ display: 'flex', flexDirection: 'column' }}>
				<section aria-label="Progression" data-reveal-block style={{ position: 'relative', height: 300, background: 'var(--sp-surface2)', display: 'flex', alignItems: 'flex-end', padding: '0 72px 34px', overflow: 'hidden' }}>
					{app && <HeroImage app={app} />}
					<div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,.15) 0%, var(--sp-bg) 100%)' }} />
					<span style={{ position: 'absolute', top: 24, right: 72, fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#fff' }}>{clock}</span>
					<div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 48, width: '100%' }}>
						<span style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
							<span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.75)' }}>Succès</span>
							<span style={{ fontSize: 72, fontWeight: 800, lineHeight: 1, color: '#fff', textShadow: '0 2px 18px rgba(0,0,0,.5)' }}>{name}</span>
						</span>
						<span style={{ flex: 1 }} />
						{total > 0 && (
							<div className="spbp-glass" style={{ width: 560, flex: 'none', display: 'flex', flexDirection: 'column', gap: 14, padding: '24px 28px', borderRadius: 28 }}>
								<span style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
									<span style={{ fontSize: 52, fontWeight: 800 }}>{got.length}</span>
									<span style={{ fontSize: 24, color: 'var(--sp-muted)' }}>sur {plural(total, 'succès', 'succès')}</span>
									<span style={{ flex: 1 }} />
									<span style={{ fontSize: 26, fontWeight: 800 }}>{ratio} %</span>
								</span>
								<span className="spbp-bar" style={{ height: 12 }}>
									<i style={{ width: `${ratio}%` }} />
								</span>
							</div>
						)}
					</div>
				</section>

				{total > 0 ? (
					<>
						<div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '26px 72px 0' }}>
							{FILTERS.map((f) => (
								<span key={f.id} className="spbp-pill-static" aria-current={f.id === filter ? 'true' : undefined}>
									{f.label} · {counts[f.id]}
								</span>
							))}
							<span style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, color: 'var(--sp-muted)' }}>
								<Glyph button={GLYPH.LB} size={30} fallback="LB" />
								<Glyph button={GLYPH.RB} size={30} fallback="RB" />
								pour changer · Tri : {sortLabel.toLowerCase()}
							</span>
						</div>
						<div key={`${filter}-${sort}`} style={{ display: 'flex', flexDirection: 'column', gap: 30, padding: '24px 72px 0' }}>
							{sections
								.filter((s) => s.list.length)
								.map((s, i) => (
									<Section key={s.title} title={s.title} list={s.list} revealed={revealed} reveal={reveal} focusFirst={i === 0} />
								))}
						</div>
					</>
				) : (
					<p style={{ margin: '50px 72px', fontSize: 26, color: 'var(--sp-muted)' }}>{loading ? 'Chargement des succès…' : 'Ce jeu n’a pas de succès.'}</p>
				)}
			</Focusable>
		</BpFrame>
	);
}
