// Recherche dans le magasin (en-tête du Magasin) : champ de saisie, résultats du
// magasin Steam dans une liste sous le champ (backend.sp_store_search), ouverts sur notre page de vente. La dernière
// ligne mène à la recherche complète de Steam.
import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate, openSteamWeb, ROUTES } from '../../core/steam';
import { IconSearch } from '../library/ui';
import { money, ownershipMap, storeReady } from './data';
import { DiscountBadge, IconClose, IconExternal, Portal } from './ui';

type Result = { appid: number; name: string; image: string; final?: number; original?: number };

/** Résultats du magasin, après une courte pause dans la saisie. */
function useResults(q: string): { items: Result[]; loading: boolean; error: boolean } {
	const [st, set] = useState<{ items: Result[]; loading: boolean; error: boolean }>({ items: [], loading: false, error: false });
	useEffect(() => {
		if (q.length < 2) {
			set({ items: [], loading: false, error: false });
			return undefined;
		}
		let alive = true;
		set((s) => ({ ...s, loading: true }));
		const t = setTimeout(async () => {
			try {
				await storeReady();
				const raw: any = await backend.sp_store_search(q);
				const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
				if (!alive) return;
				if (!d?.ok) throw new Error(d?.error || 'recherche impossible');
				set({ items: (d.items || []).slice(0, 8), loading: false, error: false });
			} catch (e) {
				console.error('[steam-upgraded] recherche dans le magasin impossible', e);
				if (alive) set({ items: [], loading: false, error: true });
			}
		}, 300);
		return () => {
			alive = false;
			clearTimeout(t);
		};
	}, [q]);
	return st;
}

function price(r: Result): { now: string; old: string; pct: number } {
	if (r.final == null) return { now: '', old: '', pct: 0 };
	const pct = r.original && r.original > r.final ? Math.round((1 - r.final / r.original) * 100) : 0;
	return { now: r.final === 0 ? 'Gratuit' : money(r.final), old: pct ? money(r.original) : '', pct };
}

const steamSearchUrl = (q: string) => `https://store.steampowered.com/search/?term=${encodeURIComponent(q)}`;

export function StoreSearch() {
	const [text, setText] = useState('');
	const [active, setActive] = useState(0);
	const [listed, setListed] = useState(true);
	const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
	const box = useRef<HTMLLabelElement>(null);
	const input = useRef<HTMLInputElement>(null);
	const list = useRef<HTMLDivElement>(null);
	const q = text.trim();
	const { items, loading, error } = useResults(q);
	const own = useMemo(ownershipMap, []);
	// Lignes de la liste : les jeux, puis « Voir tous les résultats sur Steam »
	const count = q.length >= 2 ? items.length + 1 : 0;

	useEffect(() => setActive(0), [items]);

	// Liste placée sous le champ (position fixe : la page défile dessous)
	useEffect(() => {
		if (!listed || q.length < 2) {
			setPos(null);
			return undefined;
		}
		const el = box.current;
		const doc = el?.ownerDocument;
		const win = doc?.defaultView;
		const place = () => {
			const r = el?.getBoundingClientRect();
			if (!r) return;
			const W = win?.innerWidth || 0;
			const width = Math.min(460, W - 16);
			setPos({ top: r.bottom + 8, left: Math.max(8, Math.min(r.right - width, W - width - 8)), width });
		};
		place();
		const onDown = (e: MouseEvent) => {
			const t = e.target as Node;
			if (!box.current?.contains(t) && !list.current?.contains(t)) close(false);
		};
		const root = el?.closest('.sp-root');
		doc?.addEventListener('mousedown', onDown, true);
		win?.addEventListener('resize', place);
		root?.addEventListener('scroll', place);
		return () => {
			doc?.removeEventListener('mousedown', onDown, true);
			win?.removeEventListener('resize', place);
			root?.removeEventListener('scroll', place);
		};
	}, [listed, q.length >= 2]);

	const close = (clear: boolean) => {
		if (clear) {
			setText('');
			input.current?.blur();
		}
		setListed(clear);
	};

	const go = (i: number) => {
		if (i < items.length) navigate(ROUTES.storeApp(items[i].appid));
		else openSteamWeb(steamSearchUrl(q));
		setText('');
		input.current?.blur();
		setListed(true);
	};

	const onKey = (e: any) => {
		if (e.key === 'Escape') {
			e.preventDefault();
			close(true);
		} else if (!listed) {
			if (e.key === 'ArrowDown' || e.key === 'Enter') setListed(true);
		} else if (e.key === 'ArrowDown' && count) {
			e.preventDefault();
			setActive((a) => (a + 1) % count);
		} else if (e.key === 'ArrowUp' && count) {
			e.preventDefault();
			setActive((a) => (a - 1 + count) % count);
		} else if (e.key === 'Enter' && q.length >= 2) {
			e.preventDefault();
			go(loading && !items.length ? items.length : Math.min(active, count - 1));
		}
	};

	return (
		<label ref={box} className="sps-search" style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 280, maxWidth: '100%' }}>
			<span style={{ position: 'absolute', left: 12, display: 'inline-flex', color: 'var(--sp-muted)', pointerEvents: 'none' }}>
				<IconSearch />
			</span>
			<input
				ref={input}
				className="sp-input"
				type="text"
				value={text}
				onChange={(e) => {
					setText(e.currentTarget.value);
					setListed(true);
				}}
				onKeyDown={onKey}
				onFocus={() => setListed(true)}
				spellCheck={false}
				placeholder="Rechercher dans le magasin"
				aria-label="Rechercher dans le magasin"
				role="combobox"
				aria-expanded={!!pos}
				aria-controls="sps-search-list"
				aria-activedescendant={pos && count ? `sps-search-${active}` : undefined}
				style={{ width: '100%', paddingLeft: 38, paddingRight: text ? 38 : 12 }}
			/>
			{text && (
				<button type="button" aria-label="Effacer la recherche" onClick={() => close(true)} className="sp-arrow" style={{ position: 'absolute', right: 4, width: 32, height: 32 }}>
					<IconClose />
				</button>
			)}
			{pos && (
				<Portal anchor={box}>
					<div ref={list} id="sps-search-list" role="listbox" aria-label="Résultats du magasin" className="sp-pop" style={{ top: pos.top, left: pos.left, width: pos.width, display: 'flex', flexDirection: 'column', gap: 2 }}>
						{items.map((r, i) => {
							const p = price(r);
							const o = own.get(r.appid);
							return (
								<button
									key={r.appid}
									id={`sps-search-${i}`}
									type="button"
									role="option"
									aria-selected={i === active}
									tabIndex={-1}
									className="sp-pop-item sps-search-item"
									onMouseEnter={() => setActive(i)}
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => go(i)}
								>
									<span style={{ width: 92, height: 34, flex: 'none', borderRadius: 'var(--sp-r-sm)', overflow: 'hidden', background: 'var(--sp-surface2)' }}>
										{r.image && <img src={r.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
									</span>
									<span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
										<span style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
										{o && <span className="sp-muted" style={{ fontSize: 12 }}>{o.kind === 'me' ? 'Dans votre bibliothèque' : `${o.member.name} l'a déjà`}</span>}
									</span>
									{p.now && (
										<span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
											{p.pct > 0 && <DiscountBadge pct={p.pct} />}
											<span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.15 }}>
												{p.old && <s className="sp-muted" style={{ fontSize: 11.5 }}>{p.old}</s>}
												<span style={{ fontWeight: 800 }}>{p.now}</span>
											</span>
										</span>
									)}
								</button>
							);
						})}
						{!items.length && (
							<div className="sp-muted" style={{ padding: '10px 12px', fontSize: 13 }}>
								{loading ? 'Recherche…' : error ? 'Le magasin ne répond pas.' : 'Aucun jeu trouvé.'}
							</div>
						)}
						{items.length > 0 && <div className="sp-sep" />}
						<button
							id={`sps-search-${items.length}`}
							type="button"
							role="option"
							aria-selected={active === items.length}
							tabIndex={-1}
							className="sp-pop-item sps-search-item"
							onMouseEnter={() => setActive(items.length)}
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => go(items.length)}
						>
							<span style={{ display: 'inline-flex', color: 'var(--sp-muted)' }}>
								<IconExternal />
							</span>
							<span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Voir tous les résultats pour « {q} » sur Steam</span>
						</button>
					</div>
				</Portal>
			)}
		</label>
	);
}
