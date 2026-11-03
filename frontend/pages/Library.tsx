// Page Bibliothèque (/steamupgraded/library).
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../core/settings';
import { AlbumTile, LIBRARY_CSS, Tile } from './library/Grid';
import { formatInt, Pill, pillTest, plural, Selection, selectionTest, sortGames, SortId, VIEWS, viewTest, normalize, useLibrary, Game, Library, NATIVE, NativeId, onCollectionRequested, selectionForCollection, takeRequestedCollection } from './library/data';
import { Resume, SideCounts, Sidebar, SortMenu, Stats, StatsBand } from './library/Parts';
import { IconClose, IconSearch } from './library/ui';
import { AddGameButton } from './library/AddGame';
import { usePageTransition } from '../core/transitions';

const PILLS: { id: Pill; label: string }[] = [
	{ id: 'installed', label: 'Installés' },
	{ id: 'mine', label: 'À moi' },
	{ id: 'borrowed', label: 'Prêtés' },
];

// Vue, tri, filtres, recherche et défilement, retrouvés en revenant sur la page (depuis une fiche, un autre onglet)
const memo: { sel: Selection; sort: SortId; pills: Pill[]; query: string; scroll: number } = { sel: { kind: 'view', id: 'all' }, sort: 'playtime', pills: [], query: '', scroll: 0 };

/** Vue mémorisée, si elle existe encore (collection supprimée entre-temps : tous les jeux). */
function rememberedSelection(lib: Library): Selection {
	const m = memo.sel;
	if (lib.games.length && m.kind === 'coll' && !lib.collections.some((c) => c.id === m.id)) return { kind: 'view', id: 'all' };
	if (lib.games.length && m.kind === 'person' && !lib.people.some((p) => p.accountId === m.id)) return { kind: 'view', id: 'all' };
	return m;
}

export function LibraryPage() {
	const mainRef = useRef<HTMLElement>(null);
	// Défilement rétabli par la transition d'entrée, avant ses mesures : la jaquette d'où l'on revient est déjà à l'écran
	const pageRef = usePageTransition(() => {
		if (mainRef.current && memo.scroll) mainRef.current.scrollTop = memo.scroll;
	});
	const s = useSettings();
	const [lib, refresh] = useLibrary();
	const [sel, setSel] = useState<Selection>(() => {
		const r = takeRequestedCollection();
		const asked = r && selectionForCollection(r, lib);
		if (asked) {
			memo.scroll = 0;
			return asked;
		}
		return rememberedSelection(lib);
	});
	// Menu Afficher › Jeux masqués, etc. pendant que la page est ouverte
	useEffect(
		() =>
			onCollectionRequested((id) => {
				takeRequestedCollection();
				const next = selectionForCollection(id, lib);
				if (next) setSel(next);
			}),
		[lib],
	);
	const [sort, setSort] = useState<SortId>(memo.sort);
	const [pills, setPills] = useState<Pill[]>(memo.pills);
	const [query, setQuery] = useState(memo.query);
	useEffect(() => {
		Object.assign(memo, { sel, sort, pills, query });
	}, [sel, sort, pills, query]);
	const q = useDeferredValue(normalize(query.trim()));
	// Le défilement referme la tuile agrandie : classe posée directement sur la grille (aucun rendu React),
	// retirée au prochain vrai déplacement de la souris (Chromium simule des mouvements après un défilement).
	const gridRef = useRef<HTMLDivElement>(null);
	const ptr = useRef({ x: 0, y: 0, sx: 0, sy: 0 });
	const onScroll = () => {
		if (mainRef.current) memo.scroll = mainRef.current.scrollTop;
		const el = gridRef.current;
		if (!el || el.classList.contains('spl-noexp')) return;
		el.classList.add('spl-noexp');
		ptr.current.sx = ptr.current.x;
		ptr.current.sy = ptr.current.y;
	};
	const onMouseMove = (e: any) => {
		const p = ptr.current;
		p.x = e.screenX;
		p.y = e.screenY;
		const el = gridRef.current;
		if (el && el.classList.contains('spl-noexp') && Math.abs(p.x - p.sx) + Math.abs(p.y - p.sy) > 3) el.classList.remove('spl-noexp');
	};

	const counts = useMemo<SideCounts>(() => {
		const views = {} as SideCounts['views'];
		for (const v of VIEWS) views[v.id] = lib.games.filter(viewTest(v.id)).length;
		const colls = new Map<string, number>();
		for (const c of lib.collections) colls.set(c.id, lib.games.reduce((n, g) => n + (c.ids.has(g.appid) ? 1 : 0), 0));
		const people = new Map<number, number>();
		for (const p of lib.people) people.set(p.accountId, lib.games.filter(selectionTest({ kind: 'person', id: p.accountId }, lib)).length);
		const native = {} as Record<NativeId, number>;
		for (const n of NATIVE) native[n.id] = lib.native[n.id].length;
		return { views, colls, people, native };
	}, [lib]);

	const stats = useMemo<Stats>(() => {
		let mins2w = 0, played2w = 0, total = 0, launched = 0, never = 0, borrowed = 0;
		const per = new Map<number, number>();
		for (const g of lib.games) {
			mins2w += g.mins2w;
			if (g.mins2w > 0) played2w++;
			total += g.mins;
			if (g.mins > 0 || g.last) launched++;
			else never++;
			if (g.lender) {
				borrowed++;
				per.set(g.lender.accountId, (per.get(g.lender.accountId) || 0) + 1);
			}
		}
		const byLender = lib.people
			.filter((p) => !p.isMe && per.get(p.accountId))
			.map((p) => ({ p, n: per.get(p.accountId) || 0 }))
			.sort((a, b) => b.n - a.n);
		return { mins2w, played2w, total, launched, never, count: lib.games.length, borrowed, byLender };
	}, [lib]);

	const recent = useMemo(() => lib.games.filter((g) => g.last > 0).sort((a, b) => b.last - a.last).slice(0, 3), [lib]);

	const sorted = useMemo(() => sortGames(sel.kind === 'native' ? lib.native[sel.id] : lib.games, sort), [lib, sort, sel]);

	const visible = useMemo<Game[]>(() => {
		const tests = [selectionTest(sel, lib), ...pills.map(pillTest)];
		return sorted.filter((g) => (!q || g.search.includes(q)) && tests.every((t) => t(g)));
	}, [sorted, sel, pills, q, lib]);

	const selLabel = useMemo(() => {
		if (sel.kind === 'view') return VIEWS.find((v) => v.id === sel.id)?.label || '';
		if (sel.kind === 'coll') return lib.collections.find((c) => c.id === sel.id)?.name || 'Collection';
		if (sel.kind === 'native') return NATIVE.find((n) => n.id === sel.id)?.label || '';
		const p = lib.people.find((x) => x.accountId === sel.id);
		return p?.isMe ? 'Mes jeux' : `Jeux de ${p?.name || ''}`;
	}, [sel, lib]);

	// Changement de vue : le contenu arrive dans le sens de la colonne de gauche (entrées dans l'ordre affiché)
	const selKey = `${sel.kind}:${sel.id}`;
	const sideOrder = useMemo(
		() => [...VIEWS.map((v) => `view:${v.id}`), ...lib.collections.map((c) => `coll:${c.id}`), ...lib.people.map((p) => `person:${p.accountId}`), ...NATIVE.map((n) => `native:${n.id}`)],
		[lib],
	);
	const lastSel = useRef(selKey);
	const viewAnim = useRef('');
	if (lastSel.current !== selKey) {
		viewAnim.current = sideOrder.indexOf(selKey) >= sideOrder.indexOf(lastSel.current) ? 'spl-view-down' : 'spl-view-up';
		lastSel.current = selKey;
	}

	const togglePill = (id: Pill) =>
		setPills((cur) => {
			if (cur.includes(id)) return cur.filter((x) => x !== id);
			// « À moi » et « Prêtés » s'excluent
			const rest = cur.filter((x) => !((id === 'mine' && x === 'borrowed') || (id === 'borrowed' && x === 'mine')));
			return [...rest, id];
		});

	const filtered = !!q || pills.length > 0 || !(sel.kind === 'view' && sel.id === 'all');
	const reset = () => {
		setQuery('');
		setPills([]);
		setSel({ kind: 'view', id: 'all' });
	};
	const under = s.infos !== 'survol';
	// Sans Famille Steam, les filtres « À moi » et « Prêtés » ne trient rien : masqués
	const family = lib.people.length > 1;
	const oled = s.theme === 'oled';

	return (
		<div className={`sp-root spl-page${oled ? ' spl-oled' : ''}`} ref={pageRef} style={{ display: 'flex', overflow: 'hidden' }}>
			<style>{LIBRARY_CSS}</style>
			<Sidebar lib={lib} counts={counts} sel={sel} onSelect={setSel} />

			<main ref={mainRef} aria-label="Bibliothèque" onScroll={onScroll} onMouseMove={onMouseMove} style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
				<div style={{ padding: '26px 32px 56px', display: 'flex', flexDirection: 'column', gap: 28 }}>
					<header style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
						<h1 className="sp-h1">Bibliothèque</h1>
						<span className="sp-muted" style={{ flex: 1 }}>
							{plural(lib.games.length, 'jeu', 'jeux')} · {plural(counts.views.installed, 'installé', 'installés')}
						</span>
						<span style={{ alignSelf: 'center' }}>
							<AddGameButton />
						</span>
					</header>

					<Resume games={recent} onChanged={refresh} />

					<StatsBand st={stats} />

					<section aria-labelledby="spl-grid-title" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
						<div style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--sp-bg)', margin: '-12px -32px 0', padding: '12px 32px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
							<h2 id="spl-grid-title" className="sp-h2" style={{ fontSize: 17, display: 'flex', alignItems: 'baseline', gap: 10, marginRight: 'auto', minWidth: 0 }}>
								<span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selLabel}</span>
								<span className="sp-muted" style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
									{formatInt(visible.length)}
								</span>
							</h2>

							<label style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 260 }}>
								<span style={{ position: 'absolute', left: 12, display: 'inline-flex', color: 'var(--sp-muted)', pointerEvents: 'none' }}>
									<IconSearch />
								</span>
								<input
									className="sp-input"
									type="search"
									value={query}
									onChange={(e) => setQuery(e.target.value)}
									onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
									placeholder="Rechercher un jeu"
									aria-label="Rechercher un jeu"
									style={{ width: '100%', paddingLeft: 38, paddingRight: query ? 38 : 12 }}
								/>
								{query && (
									<button type="button" aria-label="Effacer la recherche" onClick={() => setQuery('')} className="sp-arrow" style={{ position: 'absolute', right: 4, width: 32, height: 32 }}>
										<IconClose />
									</button>
								)}
							</label>

							<div role="group" aria-label="Filtres rapides" style={{ display: 'flex', gap: 8 }}>
								{PILLS.filter((p) => family || p.id === 'installed').map((p) => (
									<button key={p.id} type="button" className="sp-pill" aria-pressed={pills.includes(p.id)} onClick={() => togglePill(p.id)} style={{ height: 40, borderRadius: 20, padding: '0 15px' }}>
										{p.label}
									</button>
								))}
							</div>

							<SortMenu value={sort} onChange={setSort} />
						</div>

						<div key={selKey} className={viewAnim.current || undefined}>
							{sel.kind === 'native' && sel.id === 'music' && visible.length > 0 ? (
								<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '22px 20px' }}>
									{visible.map((g) => (
										<AlbumTile key={g.appid} g={g} />
									))}
								</div>
							) : sel.kind === 'native' && sel.id === 'hidden' && !lib.native.hidden.length ? (
								<div className="sp-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 620 }}>
									<span style={{ fontSize: 17, fontWeight: 800 }}>Aucun jeu masqué</span>
									<span className="sp-muted">Un jeu masqué n’apparaît plus dans les autres vues. Pour masquer un jeu : clic droit sur sa jaquette, puis Gérer › Masquer ce jeu.</span>
								</div>
							) : visible.length > 0 ? (
								<div ref={gridRef} className="spl-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', columnGap: 20, rowGap: under ? 26 : 22 }}>
									{visible.map((g) => (
										<Tile key={g.appid} g={g} maxMins={lib.maxMins} under={under} onChanged={refresh} />
									))}
								</div>
							) : (
								<div className="sp-card" style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
									<span style={{ fontWeight: 700 }}>{lib.games.length ? 'Aucun jeu ne correspond.' : 'Bibliothèque en cours de chargement…'}</span>
									{filtered && (
										<button type="button" className="sp-btn" onClick={reset}>
											Effacer les filtres
										</button>
									)}
								</div>
							)}
						</div>
					</section>
				</div>
			</main>
		</div>
	);
}
