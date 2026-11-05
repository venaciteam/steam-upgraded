// Big Picture › Bibliothèque : rail des vues à gauche, grande grille de jaquettes ; la tuile focalisée
// grandit sur place et montre ses infos (temps, dernière session, copie). A ouvre la fiche (comme le Big Picture
// d'origine), X ouvre les options (dont Jouer), Y trie.
import { memo, useMemo, useState } from 'react';
import { DialogButton, Focusable } from 'millennium';
import { formatLastPlayed, myAccountId } from '../core/steam';
import { formatBigHours, keyOf, plural, sortGames, SORTS, useLibrary, viewTest, VIEWS } from '../pages/library/data';
import type { Game, Library, SortId, ViewId } from '../pages/library/data';
import { BpFrame, goBackBp, MemberAvatar } from './Frame';
import { Cover, openGame, openGameOptions } from './gameActions';
import { Glyph, GLYPH } from './Glyph';
import { AlbumCover, openAlbum } from './music';

type RailItem = { id: string; label: string; test: (g: Game) => boolean };

// Gardés d'une visite à l'autre (retour depuis la fiche d'un jeu)
let lastView = 'all';
let lastSort: SortId = 'playtime';
let lastFocus = 0;

function railItems(lib: Library): RailItem[] {
	const items: RailItem[] = VIEWS.map((v) => ({ id: v.id, label: v.label, test: viewTest(v.id as ViewId) }));
	const fav = lib.collections.find((c) => c.id === 'favorite');
	if (fav) items.push({ id: 'favorite', label: 'Favoris', test: (g) => fav.ids.has(g.appid) });
	// les bandes-son ne sont pas dans « Tous les jeux » : vue à part, en pochettes carrées
	if (lib.native.music.length) items.push({ id: 'music', label: 'Bandes-son', test: () => false });
	return items;
}

/** Bande-son : pochette carrée et nom ; A ouvre la page de l'album (jamais lancée comme un jeu). */
const AlbumTile = memo(function AlbumTile({ g, focus }: { g: Game; focus: boolean }) {
	return (
		<DialogButton className="spbp-result" noFocusRing autoFocus={focus} aria-label={g.name} onClick={() => openAlbum(g.appid)} onGamepadFocus={() => (lastFocus = g.appid)} onOKActionDescription="Page de l’album">
			<AlbumCover app={g.app} size="100%" radius={22} style={{ height: 'auto', aspectRatio: '1 / 1' }} />
			<span className="spbp-result-name">{g.name}</span>
			<span className="spbp-result-sub">Bande-son</span>
		</DialogButton>
	);
});

const Tile = memo(function Tile({ g, focus }: { g: Game; focus: boolean }) {
	const owner = g.lender ? keyOf(g.lender.name) : 'Votre copie';
	const copies = g.copies > 1 ? ` · ${plural(g.copies, 'copie', 'copies')}` : '';
	return (
		<DialogButton
			className="spbp-tile"
			noFocusRing
			autoFocus={focus}
			aria-label={g.name}
			// infos ajoutées sous la jaquette au focus (défilement : voir revealFocused dans Frame.tsx)
			data-reveal-extra={160}
			onClick={() => openGame(g.appid)}
			onGamepadFocus={() => (lastFocus = g.appid)}
			onOKActionDescription="Fiche du jeu"
			onSecondaryButton={(e: any) => openGameOptions(g.app, e?.currentTarget)}
			onSecondaryActionDescription="Options du jeu"
		>
			<span className="spbp-tile-space" aria-hidden="true" />
			<span className="spbp-tile-name">{g.name}</span>
			<span className="spbp-tile-card">
				<Cover app={g.app} className="spbp-cover" />
				<span className="spbp-tile-more">
					<span className="spbp-tile-more-name">{g.name}</span>
					<span className="spbp-tile-more-sub">
						{g.mins ? formatBigHours(g.mins) : 'Jamais lancé'}
						{g.last ? ` · ${formatLastPlayed(g.last)}` : ''}
					</span>
					<span className="spbp-tile-more-sub">
						<MemberAvatar accountId={g.lender?.accountId ?? myAccountId()} color={g.lender?.color || 'var(--sp-accent)'} size={26} />
						{owner}
						{copies}
					</span>
					<span className="spbp-tile-play">
						<Glyph button={GLYPH.A} size={30} fallback="A" />
						Fiche du jeu
					</span>
				</span>
			</span>
		</DialogButton>
	);
});

export function BpLibrary() {
	const [lib] = useLibrary();
	const [view, setView] = useState(lastView);
	const [sort, setSort] = useState<SortId>(lastSort);
	const rail = useMemo(() => railItems(lib), [lib]);
	const counts = useMemo(() => new Map(rail.map((r) => [r.id, r.id === 'music' ? lib.native.music.length : lib.games.filter(r.test).length])), [rail, lib]);
	const current = rail.find((r) => r.id === view) || rail[0];
	const albums = current.id === 'music';
	const games = useMemo(() => (albums ? [...lib.native.music].sort((a, b) => a.name.localeCompare(b.name, 'fr')) : sortGames(lib.games.filter(current.test), sort)), [lib, current, sort, albums]);
	const focusId = games.some((g) => g.appid === lastFocus) ? lastFocus : games[0]?.appid;

	const pickView = (id: string) => {
		lastView = id;
		lastFocus = 0;
		setView(id);
	};
	const nextSort = () => {
		const i = SORTS.findIndex((x) => x.id === sort);
		const next = SORTS[(i + 1) % SORTS.length].id;
		lastSort = next;
		setSort(next);
	};
	const installed = lib.games.filter((g) => g.installed).length;
	const multi = lib.games.filter((g) => g.copies > 1).length;
	const sortLabel = SORTS.find((x) => x.id === sort)?.label;

	return (
		<BpFrame
			tab="library"
			onBack={goBackBp}
			options={albums ? undefined : { label: 'Trier', run: nextSort }}
			info={
				albums ? (
					<span>{plural(lib.native.music.length, 'bande-son', 'bandes-son')} · par ordre alphabétique</span>
				) : (
					<span>
						{plural(lib.games.length, 'jeu', 'jeux')} · {plural(installed, 'installé', 'installés')} · {multi} avec plusieurs copies
					</span>
				)
			}
		>
			{/* rail et grille côte à côte : gauche/droite passe de l'un à l'autre */}
			<Focusable flow-children="row" style={{ display: 'flex', gap: 40, padding: '36px 64px 0', alignItems: 'flex-start' }}>
				<nav aria-label="Vues" style={{ width: 300, flex: 'none', position: 'sticky', top: 0 }}>
					<Focusable flow-children="column" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
						{rail.map((r) => (
							<DialogButton key={r.id} className="spbp-view" noFocusRing aria-pressed={r.id === current.id} onClick={() => pickView(r.id)} onOKActionDescription="Afficher">
								<span>{r.label}</span>
								<span style={{ fontSize: 18, color: 'var(--sp-muted)' }}>{counts.get(r.id) || 0}</span>
							</DialogButton>
						))}
					</Focusable>
					<span className="spbp-label" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '22px 22px 6px', fontSize: 15 }}>
						Trier
						<Glyph button={GLYPH.Y} size={24} fallback="Y" />
					</span>
					<span style={{ height: 58, padding: '0 22px', borderRadius: 18, border: '2px solid var(--sp-line)', display: 'flex', alignItems: 'center', fontSize: 20, fontWeight: 700 }}>{sortLabel}</span>
				</nav>
				<section aria-label={current.label} style={{ flex: 1, minWidth: 0 }}>
					{games.length ? (
						<Focusable flow-children="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '30px 26px', alignContent: 'start', paddingBottom: 260 }}>
							{games.map((g) => (albums ? <AlbumTile key={g.appid} g={g} focus={g.appid === focusId} /> : <Tile key={g.appid} g={g} focus={g.appid === focusId} />))}
						</Focusable>
					) : (
						<p style={{ margin: '20px 0', fontSize: 24, color: 'var(--sp-muted)' }}>Aucun jeu dans cette vue.</p>
					)}
				</section>
			</Focusable>
		</BpFrame>
	);
}
