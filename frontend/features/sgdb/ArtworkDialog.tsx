// Fenêtre « Personnaliser les visuels » (SteamGridDB + import depuis le PC).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { navigate, ROUTES } from '../../core/steam';
import { useSettings } from '../../core/settings';
import { Asset, customUrl, Game, ImageData, originalUrl, Provider, readLocalFile, SLOTS, Slot, SlotId } from './api';

const w = window as any;

type Pending = { kind: 'sgdb'; item: Asset; preview: string } | { kind: 'file'; img: ImageData; preview: string; name: string };
type Results = { items: Asset[]; total: number; page: number; limit: number };
type Load<T> = { state: 'idle' | 'loading' | 'ready' | 'error'; data?: T; error?: string; status?: number };

/** Jeu SteamGridDB choisi à la main (« Ce n'est pas le bon jeu ? »), par appid, pour la session. */
const gameOverride = new Map<number, Game>();

// ---------- Icônes (trait) ----------

const Icon = ({ d, size = 18 }: { d: string; size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d={d} />
	</svg>
);
const I_CLOSE = 'M6 6l12 12M18 6L6 18';
const I_UPLOAD = 'M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3';
const I_SEARCH = 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4';
const I_CHECK = 'M5 12l5 5L20 7';
const I_UP = 'M12 19V5M6 11l6-6 6 6';
const I_KEY = 'M15 7a4 4 0 1 1-3.9 4.9L4 19v-3h3v-3h3l1.1-1.1A4 4 0 0 1 15 7z';

// ---------- Petits composants ----------

/** Image avec repli : si l'URL ne charge pas, on garde un fond neutre. */
function Thumb({ src, style, fit = 'cover', alt = '' }: { src?: string | null; style?: CSSProperties; fit?: 'cover' | 'contain'; alt?: string }) {
	const [broken, setBroken] = useState(false);
	useEffect(() => setBroken(false), [src]);
	return (
		<span style={{ display: 'block', overflow: 'hidden', background: 'var(--sp-surface2)', ...style }}>
			{src && !broken && <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} style={{ width: '100%', height: '100%', objectFit: fit, display: 'block' }} />}
		</span>
	);
}

function Message({ title, children, action }: { title: string; children?: any; action?: any }) {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, padding: '28px 4px', maxWidth: 560 }}>
			<div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
			{children && <div className="sp-muted" style={{ lineHeight: 1.55 }}>{children}</div>}
			{action}
		</div>
	);
}

// ---------- Fenêtre ----------

export function ArtworkDialog({ app, provider, onClose }: { app: any; provider: Provider; onClose: () => void }) {
	const settings = useSettings();
	const hasKey = provider.hasKey();
	const appid: number = app.appid;
	const appName: string = app.display_name || `Jeu ${appid}`;

	const [slotId, setSlotId] = useState<SlotId>('capsule');
	const slot = SLOTS.find((s) => s.id === slotId)!;
	const [styleBySlot, setStyleBySlot] = useState<Partial<Record<SlotId, string>>>({});
	const style = styleBySlot[slotId] || '';
	const [animated, setAnimated] = useState(false);

	const [tick, setTick] = useState(0);
	const [game, setGame] = useState<Load<Game>>({ state: 'idle' });
	const [results, setResults] = useState<Load<Results>>({ state: 'idle' });
	const [moreLoading, setMoreLoading] = useState(false);
	const cache = useRef(new Map<string, Results>());

	const [searchOpen, setSearchOpen] = useState(false);
	const [term, setTerm] = useState(appName);
	const [search, setSearch] = useState<Load<Game[]>>({ state: 'idle' });

	const [pending, setPending] = useState<Partial<Record<SlotId, Pending>>>({});
	const [custom, setCustom] = useState<Partial<Record<SlotId, string | null>>>({});
	const [busy, setBusy] = useState<string | null>(null);
	const [notice, setNotice] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

	const rootRef = useRef<HTMLDivElement>(null);
	const fileRef = useRef<HTMLInputElement>(null);

	// Visuels personnalisés actuels
	async function refreshCustom() {
		const entries = await Promise.all(SLOTS.map(async (s) => [s.id, await customUrl(app, s)] as const));
		setCustom(Object.fromEntries(entries));
	}
	useEffect(() => {
		refreshCustom();
	}, [appid]);

	// Jeu SteamGridDB correspondant
	useEffect(() => {
		if (!hasKey) return undefined;
		const forced = gameOverride.get(appid);
		if (forced) {
			setGame({ state: 'ready', data: forced });
			return undefined;
		}
		let alive = true;
		setGame({ state: 'loading' });
		provider
			.game(appid)
			.then((g) => alive && setGame({ state: 'ready', data: g }))
			.catch((e) => {
				if (!alive) return;
				setGame({ state: 'error', error: e.message, status: e.status });
				if (e.status === 404) setSearchOpen(true);
			});
		return () => {
			alive = false;
		};
	}, [appid, hasKey, settings.sgdbKey, tick]);

	// Résultats pour l'emplacement et les filtres courants
	const queryKey = game.data ? `${game.data.id}|${slotId}|${style}|${animated ? 1 : 0}|${tick}` : '';
	useEffect(() => {
		if (!game.data) return undefined;
		const cached = cache.current.get(queryKey);
		if (cached) {
			setResults({ state: 'ready', data: cached });
			return undefined;
		}
		let alive = true;
		setResults({ state: 'loading' });
		provider
			.assets(slotId, game.data.id, style ? [style] : [], animated, 0)
			.then((r) => {
				cache.current.set(queryKey, r);
				if (alive) setResults({ state: 'ready', data: r });
			})
			.catch((e) => alive && setResults({ state: 'error', error: e.message, status: e.status }));
		return () => {
			alive = false;
		};
	}, [queryKey]);

	async function loadMore() {
		const cur = results.data;
		if (!cur || !game.data || moreLoading) return;
		setMoreLoading(true);
		try {
			const next = await provider.assets(slotId, game.data.id, style ? [style] : [], animated, cur.page + 1);
			const merged = { ...next, items: [...cur.items, ...next.items] };
			cache.current.set(queryKey, merged);
			setResults({ state: 'ready', data: merged });
		} catch (e: any) {
			setNotice({ kind: 'error', text: e.message });
		} finally {
			setMoreLoading(false);
		}
	}

	function retry() {
		cache.current.clear();
		setTick((t) => t + 1);
	}

	async function runSearch() {
		setSearch({ state: 'loading' });
		try {
			setSearch({ state: 'ready', data: await provider.search(term) });
		} catch (e: any) {
			setSearch({ state: 'error', error: e.message });
		}
	}
	useEffect(() => {
		if (searchOpen && hasKey && search.state === 'idle') runSearch();
	}, [searchOpen]);

	function chooseGame(g: Game) {
		gameOverride.set(appid, g);
		setGame({ state: 'ready', data: g });
		setSearchOpen(false);
		setPending((p) => Object.fromEntries(Object.entries(p).filter(([, v]) => v?.kind === 'file')));
	}

	// Fermeture : Échap (ferme d'abord la recherche) et clic sur le fond
	useEffect(() => {
		const doc = rootRef.current?.ownerDocument;
		if (!doc) return undefined;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			e.preventDefault();
			e.stopPropagation();
			if (searchOpen) setSearchOpen(false);
			else if (!busy) onClose();
		};
		doc.addEventListener('keydown', onKey, true);
		return () => doc.removeEventListener('keydown', onKey, true);
	}, [searchOpen, busy]);
	useEffect(() => {
		rootRef.current?.focus();
	}, []);

	function select(item: Asset) {
		setNotice(null);
		setPending((p) => {
			const cur = p[slotId];
			if (cur?.kind === 'sgdb' && cur.item.id === item.id) {
				const { [slotId]: _drop, ...rest } = p;
				return rest;
			}
			return { ...p, [slotId]: { kind: 'sgdb', item, preview: item.thumb } };
		});
	}

	async function onFile(e: any) {
		const file: File | undefined = e.target.files?.[0];
		e.target.value = '';
		if (!file) return;
		try {
			const img = await readLocalFile(file);
			const preview = `data:image/${img.format === 'jpg' ? 'jpeg' : 'png'};base64,${img.base64}`;
			setPending((p) => ({ ...p, [slotId]: { kind: 'file', img, preview, name: file.name } }));
			setNotice({ kind: 'ok', text: `« ${file.name} » sera appliqué à l'emplacement ${slot.label} quand vous cliquerez sur Appliquer.` });
		} catch (err: any) {
			setNotice({ kind: 'error', text: err.message });
		}
	}

	/** Attend que Steam ait pris en compte le nouveau visuel (date des visuels perso). */
	async function waitForSteam(before: number) {
		for (let i = 0; i < 20; i++) {
			const m = w.appStore?.GetAppOverviewByAppID?.(appid)?.rt_custom_image_mtime || 0;
			if (m && m !== before) return;
			await new Promise((r) => setTimeout(r, 150));
		}
	}

	async function apply() {
		const todo = SLOTS.filter((s) => pending[s.id]);
		if (!todo.length) return;
		setNotice(null);
		const before = w.appStore?.GetAppOverviewByAppID?.(appid)?.rt_custom_image_mtime || 0;
		let done = 0;
		for (const s of todo) {
			const p = pending[s.id]!;
			try {
				setBusy(`${s.label} : ${p.kind === 'sgdb' ? 'téléchargement' : 'envoi'}…`);
				const img = p.kind === 'file' ? p.img : await provider.download(p.item);
				setBusy(`${s.label} : application…`);
				await provider.apply(appid, s, img);
				done++;
				setPending((cur) => {
					const { [s.id]: _drop, ...rest } = cur;
					return rest;
				});
			} catch (e: any) {
				setBusy(null);
				setNotice({ kind: 'error', text: `${s.label} : ${e.message || e}` });
				setSlotId(s.id);
				if (done) refreshCustom();
				return;
			}
		}
		setBusy('Mise à jour de la bibliothèque…');
		await waitForSteam(before);
		setBusy(null);
		onClose();
	}

	async function restore() {
		setNotice(null);
		if (pending[slotId]) setPending(({ [slotId]: _drop, ...rest }) => rest);
		if (!custom[slotId]) return;
		setBusy(`${slot.label} : restauration…`);
		try {
			const before = w.appStore?.GetAppOverviewByAppID?.(appid)?.rt_custom_image_mtime || 0;
			await provider.clear(appid, slot);
			await waitForSteam(before);
			await refreshCustom();
			setNotice({ kind: 'ok', text: `${slot.label} : visuel d'origine restauré.` });
		} catch (e: any) {
			setNotice({ kind: 'error', text: e.message || String(e) });
		} finally {
			setBusy(null);
		}
	}

	function openSettings() {
		onClose();
		navigate(ROUTES.settings);
	}

	const pendingCount = SLOTS.filter((s) => pending[s.id]).length;
	const items = results.data?.items || [];
	const selectedId = pending[slotId]?.kind === 'sgdb' ? (pending[slotId] as any).item.id : null;
	const fit = slot.transparent ? 'contain' : 'cover';
	const checker: CSSProperties = slot.transparent
		? { background: 'repeating-conic-gradient(var(--sp-surface2) 0 25%, var(--sp-line) 0 50%) 0 0 / 16px 16px' }
		: {};

	const styleList = useMemo(() => [{ id: '', label: 'Tous' }, ...slot.styles], [slotId]);

	// ---------- Rendu ----------

	function renderResults() {
		if (!hasKey) {
			return (
				<Message
					title="Clé API SteamGridDB nécessaire"
					action={
						<button type="button" className="sp-btn sp-btn--primary" onClick={openSettings}>
							<Icon d={I_KEY} /> Ouvrir les paramètres
						</button>
					}
				>
					Pour chercher des visuels, créez une clé API gratuite sur steamgriddb.com (menu Préférences › API), puis collez-la dans Paramètres › SteamGridDB.
					<br />
					En attendant, vous pouvez importer une image depuis le PC avec le bouton de la colonne de gauche.
				</Message>
			);
		}
		if (game.state === 'loading' || game.state === 'idle') return <Skeleton slot={slot} />;
		if (game.state === 'error') {
			return (
				<Message
					title={game.status === 404 ? 'Jeu introuvable sur SteamGridDB' : 'Connexion à SteamGridDB impossible'}
					action={
						<div style={{ display: 'flex', gap: 8 }}>
							{game.status === 404 ? (
								<button type="button" className="sp-btn sp-btn--primary" onClick={() => setSearchOpen(true)}>
									<Icon d={I_SEARCH} /> Chercher par nom
								</button>
							) : (
								<button type="button" className="sp-btn" onClick={retry}>Réessayer</button>
							)}
							{(game.status === 401 || game.status === 403) && (
								<button type="button" className="sp-btn" onClick={openSettings}>Vérifier la clé</button>
							)}
						</div>
					}
				>
					{game.error}
				</Message>
			);
		}
		if (results.state === 'loading' || results.state === 'idle') return <Skeleton slot={slot} />;
		if (results.state === 'error') {
			return <Message title="Chargement des visuels impossible" action={<button type="button" className="sp-btn" onClick={retry}>Réessayer</button>}>{results.error}</Message>;
		}
		if (!items.length) {
			return (
				<Message title="Aucun résultat">
					{animated ? 'Aucun visuel animé compatible pour cet emplacement.' : 'Aucun visuel pour cet emplacement avec ce filtre.'} Essayez un autre style
					{style ? ' ou « Tous »' : ''}, ou importe une image depuis le PC.
				</Message>
			);
		}
		return (
			<>
				<div style={{ display: 'grid', gridTemplateColumns: `repeat(${slot.columns}, minmax(0, 1fr))`, gap: 14 }}>
					{items.map((it) => {
						const sel = it.id === selectedId;
						return (
							<button
								key={it.id}
								type="button"
								aria-pressed={sel}
								aria-label={`Visuel de ${it.author}, ${it.upvotes} votes${it.animated ? ', animé' : ''}`}
								onClick={() => select(it)}
								style={{ padding: 0, border: 0, background: 'transparent', display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', minWidth: 0 }}
							>
								<Thumb
									src={it.thumb}
									fit={fit}
									style={{
										width: '100%',
										aspectRatio: String(slot.ratio),
										borderRadius: 'var(--sp-r-sm)',
										outline: sel ? '2px solid var(--sp-accent)' : '1px solid transparent',
										outlineOffset: 2,
										...checker,
									}}
								/>
								<span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: sel ? 'var(--sp-text)' : 'var(--sp-muted)', minWidth: 0 }}>
									{sel && (
										<span style={{ color: 'var(--sp-accent)', display: 'inline-flex' }}>
											<Icon d={I_CHECK} size={13} />
										</span>
									)}
									<span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.author}</span>
									{it.animated && (
										<span className="sp-badge" style={{ padding: '1px 5px', fontSize: 9, background: 'var(--sp-surface2)', color: 'var(--sp-text)' }}>ANIMÉ</span>
									)}
									<span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flex: 'none' }}>
										<Icon d={I_UP} size={11} />
										{it.upvotes}
									</span>
								</span>
							</button>
						);
					})}
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
					<span className="sp-muted" style={{ fontSize: 12 }}>
						{results.data!.total} résultat{results.data!.total > 1 ? 's' : ''} · classés par score SteamGridDB
						{animated ? ' · animés au format PNG animé uniquement (Steam refuse WebP et GIF)' : ''}
					</span>
					<span style={{ flex: 1 }} />
					{items.length < results.data!.total && (
						<button type="button" className="sp-btn" onClick={loadMore} disabled={moreLoading}>
							{moreLoading ? 'Chargement…' : 'Afficher plus'}
						</button>
					)}
				</div>
			</>
		);
	}

	return (
		<div
			ref={rootRef}
			tabIndex={-1}
			className="sp-root sp-scrim"
			style={{ outline: 0, height: 'auto' }}
			onMouseDown={(e) => {
				if (e.target === e.currentTarget && !busy) onClose();
			}}
		>
			{/* .sp-root button force align-items:stretch : on recentre le contenu des boutons de la fenêtre */}
			<style>{'#sp-sgdb-dialog .sp-btn,#sp-sgdb-dialog .sp-pill{align-items:center;}#sp-sgdb-dialog button:disabled{cursor:default;}'}</style>
			<section role="dialog" aria-modal="true" aria-labelledby="sp-sgdb-title" className="sp-card sp-dialog" style={{ height: 'min(880px, 100%)' }}>
				{/* En-tête */}
				<div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, padding: '20px 24px', borderBottom: '1px solid var(--sp-line)' }}>
					<div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
						<h2 id="sp-sgdb-title" className="sp-h2" style={{ fontSize: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
							Personnaliser les visuels · {appName}
						</h2>
						{hasKey && (
							<span className="sp-muted" style={{ fontSize: 13 }}>
								{game.data ? `Résultats SteamGridDB pour « ${game.data.name} »` : 'Recherche du jeu sur SteamGridDB…'}
								{' · '}
								<button type="button" onClick={() => setSearchOpen((o) => !o)} aria-expanded={searchOpen} style={{ padding: 0, border: 0, background: 'transparent', color: 'var(--sp-accent)', fontWeight: 700 }}>
									Ce n'est pas le bon jeu ?
								</button>
							</span>
						)}
					</div>
					{provider.badge && (
						<span className="sp-badge" style={{ background: 'var(--sp-busy)', color: 'var(--sp-accent-ink)' }}>{provider.badge}</span>
					)}
					<span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: hasKey ? 'var(--sp-online)' : 'var(--sp-muted)' }}>
						<span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }} />
						{hasKey ? 'Clé API SteamGridDB active' : 'Aucune clé API SteamGridDB'}
					</span>
					<button type="button" className="sp-btn sp-btn--icon" aria-label="Fermer" onClick={onClose} disabled={!!busy} style={{ width: 44, height: 44, border: 0, background: 'var(--sp-surface2)' }}>
						<Icon d={I_CLOSE} />
					</button>
				</div>

				{/* Recherche d'un autre jeu */}
				{searchOpen && hasKey && (
					<div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 24px', borderBottom: '1px solid var(--sp-line)', background: 'var(--sp-bg)' }}>
						<form
							style={{ display: 'flex', gap: 8 }}
							onSubmit={(e) => {
								e.preventDefault();
								runSearch();
							}}
						>
							<input className="sp-input" style={{ flex: 1 }} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Nom du jeu sur SteamGridDB" aria-label="Nom du jeu" autoFocus />
							<button type="submit" className="sp-btn sp-btn--primary">
								<Icon d={I_SEARCH} /> Chercher
							</button>
						</form>
						<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
							{search.state === 'loading' && <span className="sp-muted">Recherche…</span>}
							{search.state === 'error' && <span style={{ color: 'var(--sp-busy)' }}>{search.error}</span>}
							{search.state === 'ready' && !search.data!.length && <span className="sp-muted">Aucun jeu trouvé pour « {term} ».</span>}
							{search.data?.slice(0, 12).map((g) => (
								<button key={g.id} type="button" className="sp-pill" aria-pressed={game.data?.id === g.id} onClick={() => chooseGame(g)}>
									{g.name}
									{g.year ? <span className="sp-muted">{g.year}</span> : null}
									{g.verified && (
										<span style={{ color: 'var(--sp-online)', display: 'inline-flex' }} aria-label="vérifié">
											<Icon d={I_CHECK} size={13} />
										</span>
									)}
								</button>
							))}
						</div>
					</div>
				)}

				{/* Corps */}
				<div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
					{/* Emplacements */}
					<div style={{ flex: '0 0 320px', padding: 20, borderRight: '1px solid var(--sp-line)', display: 'flex', flexDirection: 'column', gap: 6, overflow: 'auto' }}>
						<div className="sp-label" style={{ paddingBottom: 6 }}>Emplacement</div>
						{SLOTS.map((s) => {
							const on = s.id === slotId;
							const p = pending[s.id];
							const state = p ? 'À appliquer' : custom[s.id] ? 'Modifié' : 'Original';
							const src = p?.preview || custom[s.id] || originalUrl(app, s);
							return (
								<button
									key={s.id}
									type="button"
									aria-pressed={on}
									onClick={() => {
										setSlotId(s.id);
										setNotice(null);
									}}
									style={{
										display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '8px 10px', borderRadius: 'var(--sp-r-sm)',
										border: `1px solid ${on ? 'var(--sp-accent)' : 'transparent'}`, background: on ? 'var(--sp-surface2)' : 'transparent', textAlign: 'left',
									}}
								>
									<span style={{ width: 44, display: 'flex', justifyContent: 'center', flex: 'none' }}>
										<Thumb src={src} fit={s.transparent ? 'contain' : 'cover'} style={{ width: s.thumb[0], height: s.thumb[1], borderRadius: 4 }} />
									</span>
									<span style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
										<span style={{ fontWeight: 700 }}>{s.label}</span>
										<span className="sp-muted" style={{ fontSize: 12 }}>{s.sub}</span>
									</span>
									<span style={{ fontSize: 11, fontWeight: 700, color: state === 'Original' ? 'var(--sp-muted)' : 'var(--sp-accent)', textAlign: 'right' }}>{state}</span>
								</button>
							);
						})}
						<div style={{ flex: 1 }} />
						<input ref={fileRef} type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={onFile} />
						<button
							type="button"
							onClick={() => fileRef.current?.click()}
							disabled={!!busy}
							style={{ marginTop: 12, minHeight: 44, borderRadius: 'var(--sp-r-sm)', border: '1px dashed var(--sp-line)', background: 'transparent', color: 'var(--sp-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
						>
							<Icon d={I_UPLOAD} size={16} /> Importer un fichier depuis le PC…
						</button>
					</div>

					{/* Résultats */}
					<div style={{ flex: 1, minWidth: 0, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
						<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
							<span style={{ fontWeight: 800, marginRight: 6 }}>
								{slot.label} · {slot.size}
							</span>
							{hasKey &&
								styleList.map((f) => (
									<button key={f.id || 'all'} type="button" className="sp-pill" aria-pressed={style === f.id} onClick={() => setStyleBySlot((m) => ({ ...m, [slotId]: f.id }))}>
										{f.label}
									</button>
								))}
							<span style={{ flex: 1 }} />
							{hasKey && (
								<label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--sp-muted)', cursor: 'pointer' }}>
									<input type="checkbox" checked={animated} onChange={(e) => setAnimated(e.target.checked)} style={{ accentColor: 'var(--sp-accent)' as any, width: 16, height: 16 }} />
									Animés
								</label>
							)}
						</div>
						{pending[slotId]?.kind === 'file' && (
							<div className="sp-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12, borderRadius: 'var(--sp-r-md)' }}>
								<Thumb src={pending[slotId]!.preview} fit={fit} style={{ width: 96, aspectRatio: String(slot.ratio), borderRadius: 'var(--sp-r-sm)', ...checker }} />
								<span style={{ flex: 1, minWidth: 0 }}>
									<span style={{ fontWeight: 700 }}>Fichier importé</span>
									<br />
									<span className="sp-muted" style={{ fontSize: 12 }}>{(pending[slotId] as any).name}</span>
								</span>
								<button type="button" className="sp-btn" onClick={() => setPending(({ [slotId]: _drop, ...rest }) => rest)}>Retirer</button>
							</div>
						)}
						{renderResults()}
					</div>
				</div>

				{/* Pied */}
				<div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '16px 24px', borderTop: '1px solid var(--sp-line)', background: 'var(--sp-bg)' }}>
					<button type="button" className="sp-btn" onClick={restore} disabled={!!busy || (!custom[slotId] && !pending[slotId])} style={{ height: 44 }}>
						Restaurer l'original
					</button>
					<span style={{ fontSize: 13, color: notice?.kind === 'error' ? 'var(--sp-busy)' : 'var(--sp-muted)', flex: 1, minWidth: 200 }} role="status" aria-live="polite">
						{busy || notice?.text || (pendingCount > 1 ? `${pendingCount} emplacements seront modifiés.` : '')}
					</span>
					<button type="button" className="sp-btn" onClick={onClose} disabled={!!busy} style={{ height: 44 }}>
						Annuler
					</button>
					<button type="button" className="sp-btn sp-btn--primary" onClick={apply} disabled={!!busy || !pendingCount} style={{ height: 44, padding: '0 22px', opacity: !pendingCount ? 0.5 : 1 }}>
						{busy ? 'Application…' : pendingCount > 1 ? `Appliquer (${pendingCount})` : 'Appliquer'}
					</button>
				</div>
			</section>
		</div>
	);
}

function Skeleton({ slot }: { slot: Slot }) {
	return (
		<div aria-busy="true" aria-label="Chargement" style={{ display: 'grid', gridTemplateColumns: `repeat(${slot.columns}, minmax(0, 1fr))`, gap: 14 }}>
			{Array.from({ length: slot.columns * 2 }, (_, i) => (
				<span key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
					<span style={{ display: 'block', aspectRatio: String(slot.ratio), borderRadius: 'var(--sp-r-sm)', background: 'var(--sp-surface2)', opacity: 0.6 }} />
					<span style={{ display: 'block', height: 10, width: '60%', borderRadius: 4, background: 'var(--sp-surface2)', opacity: 0.6 }} />
				</span>
			))}
		</div>
	);
}
