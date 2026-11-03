// Big Picture › Recherche (remplace /search) : un champ (clavier virtuel de Steam sur A), des catégories
// changées avec LB/RB (Tout, Bibliothèque, Contacts, Magasin, Outils) et les résultats en grille.
import { useEffect, useMemo, useRef, useState } from 'react';
import { DialogButton, Focusable, GamepadButton, TextField } from 'millennium';
import { allApps, avatarUrl, bpRouter, landscapeUrl, playerName } from '../core/steam';
import { BpFrame, goBackBp, useClock } from './Frame';
import { NowPlayingPill } from './music';
import { Landscape, openGame, openStoreBp } from './gameActions';
import { Glyph, GLYPH } from './Glyph';
import { money, storeReady } from '../pages/store/data';

const w = window as any;

type Cat = 'all' | 'library' | 'contacts' | 'store' | 'tools';

const CATS: { id: Cat; label: string }[] = [
	{ id: 'all', label: 'Tout' },
	{ id: 'library', label: 'Bibliothèque' },
	{ id: 'contacts', label: 'Contacts' },
	{ id: 'store', label: 'Magasin' },
	{ id: 'tools', label: 'Outils' },
];

/** Au-delà, la grille devient lourde à parcourir : il vaut mieux affiner la recherche. */
const MAX_RESULTS = 120;

type Result =
	| { kind: 'game' | 'tool'; key: string; name: string; app: any }
	| { kind: 'contact'; key: string; name: string; accountId: number; status: string; online: boolean }
	| { kind: 'store'; key: string; name: string; appid: number; image?: string; price: string };

function norm(s: string): string {
	return s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[™®©]/g, '')
		.toLowerCase()
		.trim();
}

function matches(name: string, q: string): boolean {
	return !q || norm(name).includes(q);
}

function toolApps(): any[] {
	return w.collectionStore?.GetCollection?.('type-tools')?.allApps || [];
}

function contacts(): { accountId: number; name: string; status: string; online: boolean }[] {
	const ui = w.friendStore?.m_FriendsUIFriendStore;
	const ids: number[] = [...(ui?.m_setFriendAccountIDs || [])];
	return ids.map((id) => {
		const p = ui?.m_mapPlayerCache?.get(id)?.m_persona;
		const online = Number(p?.m_ePersonaState || 0) !== 0;
		const game = p?.m_strGameExtraInfo || (p?.m_unGamePlayedAppID ? w.appStore?.GetAppOverviewByAppID?.(Number(p.m_unGamePlayedAppID))?.display_name : '');
		return { accountId: id, name: playerName(id), online, status: game ? `En jeu : ${game}` : online ? 'En ligne' : 'Hors ligne' };
	});
}

function price(cents?: number): string {
	if (cents == null) return '';
	return cents === 0 ? 'Gratuit' : money(cents);
}

/** Résultats du magasin : on attend une courte pause dans la saisie avant d'interroger Steam. */
function useStoreResults(q: string): { items: Result[]; loading: boolean } {
	const [st, set] = useState<{ items: Result[]; loading: boolean }>({ items: [], loading: false });
	useEffect(() => {
		if (q.length < 2) {
			set({ items: [], loading: false });
			return undefined;
		}
		let alive = true;
		set((s) => ({ ...s, loading: true }));
		const t = setTimeout(async () => {
			try {
				await storeReady();
				const raw: any = await (backend as any).sp_store_search(q);
				const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
				if (!alive) return;
				const items: Result[] = (d?.items || []).map((it: any) => ({
					kind: 'store',
					key: `s${it.appid}`,
					name: it.name || '',
					appid: it.appid,
					image: it.image,
					price: price(it.final),
				}));
				set({ items, loading: false });
			} catch (e) {
				console.error('[steam-upgraded] recherche dans le magasin impossible', e);
				if (alive) set({ items: [], loading: false });
			}
		}, 450);
		return () => {
			alive = false;
			clearTimeout(t);
		};
	}, [q]);
	return st;
}

function ResultCard({ r }: { r: Result }) {
	if (r.kind === 'contact') {
		const src = avatarUrl(r.accountId);
		return (
			<DialogButton className="spbp-result spbp-result--contact" noFocusRing onClick={() => bpRouter()?.MenuStore?.OpenQuickAccessMenu?.(3)} onOKActionDescription="Contacts et chat" aria-label={`${r.name}, ${r.status}`}>
				<span className="spbp-result-img spbp-result-person">
					{src ? <img src={src} alt="" /> : <span aria-hidden="true">{r.name.charAt(0).toUpperCase()}</span>}
				</span>
				<span className="spbp-result-name">{r.name}</span>
				<span className="spbp-result-sub" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
					<span className="spbp-dot" style={{ width: 10, height: 10, background: r.online ? 'var(--sp-online)' : 'var(--sp-muted)' }} />
					{r.status}
				</span>
			</DialogButton>
		);
	}
	if (r.kind === 'store') {
		return (
			<DialogButton className="spbp-result" noFocusRing onClick={() => openStoreBp(r.appid)} onOKActionDescription="Page de vente" aria-label={`${r.name}${r.price ? `, ${r.price}` : ''}`}>
				{r.image ? <img src={r.image} alt="" className="spbp-result-img" loading="lazy" /> : <span className="spbp-result-img" />}
				<span className="spbp-result-name">{r.name}</span>
				<span className="spbp-result-sub">{r.price ? `Magasin · ${r.price}` : 'Magasin'}</span>
			</DialogButton>
		);
	}
	return (
		<DialogButton className="spbp-result" noFocusRing onClick={() => openGame(r.app.appid)} onOKActionDescription="Fiche du jeu" aria-label={r.name}>
			<Landscape app={r.app} fallback={landscapeUrl(r.app)} className="spbp-result-img" />
			<span className="spbp-result-name">{r.name}</span>
			<span className="spbp-result-sub">{r.kind === 'tool' ? 'Outil' : r.app.installed ? 'Installé' : 'Dans la bibliothèque'}</span>
		</DialogButton>
	);
}

export function BpSearch() {
	const [text, setText] = useState('');
	const [cat, setCat] = useState<Cat>('all');
	const clock = useClock();
	const q = norm(text);
	const store = useStoreResults(text.trim());
	const field = useRef<HTMLDivElement>(null);

	const local = useMemo(() => {
		const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
		const toolIds = new Set(toolApps().map((a: any) => a.appid));
		const games: Result[] = allApps()
			.filter((a: any) => !toolIds.has(a.appid) && matches(a.display_name || '', q))
			.map((a: any) => ({ kind: 'game' as const, key: `g${a.appid}`, name: a.display_name, app: a }))
			.sort(byName);
		const tools: Result[] = toolApps()
			.filter((a: any) => matches(a.display_name || '', q))
			.map((a: any) => ({ kind: 'tool' as const, key: `t${a.appid}`, name: a.display_name, app: a }))
			.sort(byName);
		const people: Result[] = contacts()
			.filter((c) => matches(c.name, q))
			.map((c) => ({ kind: 'contact' as const, key: `c${c.accountId}`, ...c }))
			.sort((a, b) => Number(b.online) - Number(a.online) || byName(a, b));
		return { games, tools, people };
	}, [q]);

	const lists: Record<Cat, Result[]> = {
		library: local.games,
		contacts: local.people,
		store: store.items,
		tools: local.tools,
		all: [...local.people.slice(0, q ? 6 : 0), ...local.games, ...store.items.slice(0, 6), ...local.tools],
	};
	const shown = lists[cat].slice(0, MAX_RESULTS);
	const more = lists[cat].length - shown.length;

	const step = (d: number) => {
		const i = CATS.findIndex((c) => c.id === cat);
		if (CATS[i + d]) setCat(CATS[i + d].id);
	};
	const onButtonDown = (e: any) => {
		const b = e?.detail?.button;
		if (b === GamepadButton.BUMPER_LEFT) step(-1);
		if (b === GamepadButton.BUMPER_RIGHT) step(1);
	};
	const empty = !shown.length && (cat !== 'store' || !store.loading);
	const info = cat === 'store' && text.trim().length < 2 ? 'Tapez au moins deux lettres pour chercher dans le magasin' : more > 0 ? `${MAX_RESULTS} premiers résultats affichés : précisez la recherche` : 'Bibliothèque, contacts, magasin et outils';

	return (
		<BpFrame header={false} onBack={goBackBp} info={<span>{info}</span>} secondary={text ? { label: 'Effacer', run: () => setText('') } : undefined}>
			<Focusable onButtonDown={onButtonDown} style={{ display: 'flex', flexDirection: 'column' }}>
				<header style={{ display: 'flex', alignItems: 'center', gap: 28, padding: '28px 72px 0' }}>
					<div ref={field} className="spbp-search">
						<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
							<circle cx="11" cy="11" r="7" />
							<path d="m20 20-3.5-3.5" />
						</svg>
						<TextField value={text} focusOnMount onChange={(e) => setText(e.target.value)} {...({ placeholder: "Rechercher des jeux ou des profils" } as any)} aria-label="Rechercher des jeux ou des profils" />
					</div>
					<NowPlayingPill />
					<span className="spbp-clock">{clock}</span>
				</header>

				<nav aria-label="Catégories" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 72px 0' }}>
					{CATS.map((c) => (
						<span key={c.id} className="spbp-cat" aria-current={c.id === cat ? 'true' : undefined}>
							{c.label}
							<span style={{ fontSize: 17, opacity: 0.7 }}>{c.id === 'store' && store.loading ? '…' : lists[c.id].length}</span>
						</span>
					))}
					<span style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, color: 'var(--sp-muted)' }}>
						<Glyph button={GLYPH.LB} size={30} fallback="LB" />
						<Glyph button={GLYPH.RB} size={30} fallback="RB" />
						pour changer
					</span>
				</nav>

				{empty ? (
					<p style={{ margin: '40px 72px', fontSize: 24, color: 'var(--sp-muted)' }}>{text ? 'Aucun résultat.' : cat === 'store' ? 'Tapez le nom d’un jeu pour chercher dans le magasin.' : 'Rien à afficher.'}</p>
				) : (
					<Focusable key={cat} flow-children="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '26px 24px', padding: '28px 72px 0' }}>
						{shown.map((r) => (
							<ResultCard key={r.key} r={r} />
						))}
					</Focusable>
				)}
			</Focusable>
		</BpFrame>
	);
}
