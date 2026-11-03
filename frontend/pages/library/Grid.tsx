// Grille de jaquettes. Au survol, la tuile s'agrandit sur place et révèle un panneau d'infos sous la jaquette.
// Tout passe par le CSS (:hover + transition-delay) : aucun état partagé, la grille ne se re-rend jamais au survol.
// Seul état local : le panneau n'est monté qu'au premier survol (ou focus) de la tuile.
import { memo, useEffect, useState } from 'react';
import { avatarUrl, formatLastPlayed, navigate, ROUTES } from '../../core/steam';
import { formatBigHours, Game, keyOf, loadOwners, Owner } from './data';
import { useArt } from '../../core/art';
import { useAlbumCover } from '../../features/music';
import { Dot, IconCheck, IconCopies, PlayButton } from './ui';
import { openGameMenu } from './menu';

function Cover({ g }: { g: Game }) {
	const src = useArt(g.app, 'capsule', g.cover);
	const [broken, setBroken] = useState(false);
	useEffect(() => setBroken(false), [src]);
	if (!src || broken)
		return (
			<span className="spl-cover-fallback">
				<span>{g.name}</span>
			</span>
		);
	return <img src={src} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setBroken(true)} />;
}

/** Petite photo de profil d'un propriétaire (contour à sa couleur), point coloré si la photo manque. */
function OwnerFace({ o }: { o: Owner }) {
	const [broken, setBroken] = useState(false);
	const src = avatarUrl(o.accountId);
	if (!src || broken) return <Dot color={o.color} size={8} />;
	return <img src={src} alt="" width={16} height={16} onError={() => setBroken(true)} style={{ width: 16, height: 16, borderRadius: '50%', flex: 'none', boxShadow: `0 0 0 1.5px ${o.color}` }} />;
}

export function Progress({ mins, max }: { mins: number; max: number }) {
	const pct = max > 0 && mins > 0 ? Math.max(2, Math.round((mins / max) * 100)) : 0;
	return (
		<span className="sp-bar" style={{ display: 'block' }} role="presentation">
			<i style={{ width: `${pct}%` }} />
		</span>
	);
}

/** Pastille « copies dans la famille » (sous la jaquette). Compacte quand elle suit « Clé de … ». */
function CopiesChip({ n, compact }: { n: number; compact: boolean }) {
	return (
		<span className="spl-copies" title={`${n} copies dans la famille`}>
			<IconCopies size={11} />
			{compact ? n : `${n} copies`}
		</span>
	);
}

/** Propriétaires du jeu dans la famille, chargés à la demande (premier survol), copie utilisée cochée. */
function Owners({ g }: { g: Game }) {
	const [list, set] = useState<Owner[] | null>(null);
	useEffect(() => {
		let alive = true;
		loadOwners(g.appid).then(
			(l) => alive && set(l),
			() => alive && set([]),
		);
		return () => {
			alive = false;
		};
	}, [g.appid]);
	return (
		<span className="spl-owners">
			<span className="spl-pline spl-pmuted">{g.copies} copies dans la famille</span>
			{list && list.length > 0 && (
				<span className="spl-owner-list" role="list">
					{list.map((o) => (
						<span key={o.accountId} role="listitem" className={o.preferred ? 'spl-owner is-pref' : 'spl-owner'} title={o.preferred ? `Copie utilisée : ${o.isMe ? 'la vôtre' : `celle de ${o.name}`}` : undefined}>
							<OwnerFace o={o} />
							{o.name}
							{o.preferred && (
								<span className="spl-pref">
									<IconCheck />
									<span className="spl-sr">(copie utilisée)</span>
								</span>
							)}
						</span>
					))}
				</span>
			)}
		</span>
	);
}

/** Panneau révélé sous la jaquette quand la tuile est agrandie. Fait partie de la tuile. */
function TilePanel({ g, maxMins, onOpen }: { g: Game; maxMins: number; onOpen: () => void }) {
	return (
		<div className="spl-panel" onClick={onOpen}>
			<span className="spl-surface" aria-hidden="true" />
			<div className="spl-panel-in">
				<span className="spl-pname">{g.name}</span>
				{g.mins > 0 && <Progress mins={g.mins} max={maxMins} />}
				<span className="spl-pline">
					{g.mins ? (
						<>
							<b>{formatBigHours(g.mins)}</b> de jeu
						</>
					) : (
						<b>Jamais lancé</b>
					)}
					{g.mins2w > 0 && <span className="spl-pmuted"> · {formatBigHours(g.mins2w)} en 2 sem.</span>}
				</span>
				{g.last > 0 && (
					<span className="spl-pline">
						<span className="spl-pmuted">Dernière session</span> <b>{formatLastPlayed(g.last)}</b>
					</span>
				)}
				{g.copies > 1 ? (
					<Owners g={g} />
				) : g.lender && (
					<span className="spl-pline spl-lender" title={g.lender.name}>
						<Dot color={g.lender.color} size={8} />
						<span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{keyOf(g.lender.name)}</span>
					</span>
				)}
				<span className="spl-pactions">
					<PlayButton g={g} compact style={{ flex: 1, minWidth: 0, height: 32, padding: '0 10px', fontSize: 13, gap: 6 }} />
					<button
						type="button"
						className="sp-btn"
						aria-label={`Fiche du jeu : ${g.name}`}
						onClick={(e) => {
							e.stopPropagation();
							onOpen();
						}}
						style={{ flex: 'none', height: 32, padding: '0 11px', fontSize: 13 }}
					>
						Fiche
					</button>
				</span>
			</div>
		</div>
	);
}

type TileProps = { g: Game; maxMins: number; under: boolean; onChanged: () => void };

export const Tile = memo(function Tile({ g, maxMins, under, onChanged }: TileProps) {
	const [armed, setArmed] = useState(false);
	const arm = () => {
		if (!armed) setArmed(true);
	};
	const open = () => navigate(ROUTES.app(g.appid));
	return (
		<div className="spl-tile" onMouseEnter={arm} onFocus={arm} onContextMenu={(e) => openGameMenu(e, g, onChanged)}>
			<div className="spl-tcard">
				<button type="button" className="spl-hit" aria-label={`${g.name}${under ? '' : `, ${formatBigHours(g.mins)} de jeu`}${g.copies > 1 ? `, ${g.copies} copies dans la famille` : ''}`} onClick={open}>
					<span className="spl-cover" data-sp-appid={g.appid} data-sp-kind="tile">
						<Cover g={g} />
					</span>
					{under && (
						<span className="spl-meta">
							<span className="spl-name">{g.name}</span>
							<Progress mins={g.mins} max={maxMins} />
							<span className="spl-sub">
								<span style={{ flex: 'none' }}>{g.mins ? formatBigHours(g.mins) : 'Jamais lancé'}</span>
								{(g.lender || g.copies > 1) && (
									<span className="spl-keyline">
										{g.lender && (
											<span className="spl-lender" title={keyOf(g.lender.name)}>
												<Dot color={g.lender.color} size={7} />
												<span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{keyOf(g.lender.name)}</span>
											</span>
										)}
										{g.copies > 1 && <CopiesChip n={g.copies} compact={!!g.lender} />}
									</span>
								)}
							</span>
						</span>
					)}
				</button>
				{armed && <TilePanel g={g} maxMins={maxMins} onOpen={open} />}
			</div>
		</div>
	);
});

/** Pochette carrée d'une bande-son (copie locale de Steam d'abord), nom de l'album si elle manque. */
function AlbumCover({ g }: { g: Game }) {
	// Pochette réduite (les originaux, jusqu'à 3000 px, restaient parfois gris dans la grille)
	const { src, failed } = useAlbumCover(g.app, 480);
	if (failed)
		return (
			<span className="spl-cover-fallback">
				<span>{g.name}</span>
			</span>
		);
	return src ? <img src={src} alt="" decoding="async" draggable={false} /> : null;
}

/** Bande-son : pochette carrée et nom, sans temps de jeu ni panneau. */
export function AlbumTile({ g }: { g: Game }) {
	return (
		<button type="button" className="spl-hit" aria-label={g.name} onClick={() => navigate(ROUTES.album(g.appid))}>
			<span className="spl-cover" style={{ aspectRatio: '1 / 1' }} data-sp-appid={g.appid} data-sp-kind="album">
				<AlbumCover g={g} />
			</span>
			<span className="spl-name" style={{ whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any}>
				{g.name}
			</span>
		</button>
	);
}

// États « agrandi » : survol (après un délai, pour qu'un balayage ne déclenche rien) ou focus clavier (immédiat).
// .spl-noexp est posée sur la grille pendant un défilement et retirée au prochain vrai mouvement de souris.
const H = '.spl-grid:not(.spl-noexp) .spl-tile:hover';
const F = '.spl-grid:not(.spl-noexp) .spl-tile:has(:focus-visible)';
const both = (sel: string) => `${H} ${sel},${F} ${sel}`;
const DELAY = '.27s';

/** Feuille propre à la page (états :hover impossibles en style inline). */
export const LIBRARY_CSS = `
/* theme.ts force align-items:stretch sur les boutons de .sp-root : on recentre ceux de la page */
.spl-page button,.spl-sortpop button{align-items:center;}
.spl-page button.spl-hit{align-items:stretch;}
.spl-tile{position:relative;z-index:0;min-width:0;transition:z-index 0s linear .2s;}
${H}{z-index:3;transition-delay:${DELAY};}
${F}{z-index:3;transition-delay:0s;}
.spl-tcard{position:relative;z-index:0;transform-origin:50% 50%;transition:transform .2s cubic-bezier(.2,.8,.3,1) 0s;}
${H} .spl-tcard{transform:scale(1.07);transition-delay:${DELAY};}
${F} .spl-tcard{transform:scale(1.07);}
.spl-hit{display:flex;flex-direction:column;gap:10px;width:100%;padding:0;border:0;background:transparent;text-align:left;color:var(--sp-text);min-width:0;outline:none;}
.spl-cover{position:relative;display:block;aspect-ratio:2/3;border-radius:var(--sp-r-cover);overflow:hidden;background:var(--sp-surface2);outline:1.5px solid transparent;outline-offset:0;}
.spl-cover img{display:block;width:100%;height:100%;object-fit:cover;}
.spl-cover-fallback{display:flex;align-items:flex-end;width:100%;height:100%;padding:14px;font-weight:800;font-size:14px;color:var(--sp-muted);background:var(--sp-surface2);}
.spl-hit:focus-visible .spl-cover{outline-color:var(--sp-accent);}
.spl-oled .spl-cover{outline-color:var(--sp-line);outline-width:1px;}
.spl-meta{display:flex;flex-direction:column;gap:7px;padding:0 2px;min-width:0;transition:opacity .12s ease 0s;}
${H} .spl-meta{opacity:0;transition-delay:${DELAY};}
${F} .spl-meta{opacity:0;}
.spl-name{font-size:13.5px;font-weight:700;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.spl-sub{display:flex;flex-direction:column;gap:3px;font-size:12px;line-height:1.35;color:var(--sp-muted);min-width:0;}
.spl-lender{display:flex;align-items:center;gap:6px;min-width:0;white-space:nowrap;}
.spl-keyline{display:flex;align-items:center;gap:7px;min-width:0;}
.spl-copies{display:inline-flex;align-items:center;gap:4px;flex:none;height:18px;padding:0 6px;border-radius:9px;background:var(--sp-surface2);color:var(--sp-muted);font-size:11px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap;}
.spl-oled .spl-copies{background:transparent;box-shadow:inset 0 0 0 1px var(--sp-line);}
.spl-owners{display:flex;flex-direction:column;gap:8px;min-width:0;}
.spl-owner-list{display:flex;flex-wrap:wrap;gap:8px 12px;min-width:0;}
.spl-owner{display:inline-flex;align-items:center;gap:5px;font-size:12px;line-height:1.35;white-space:nowrap;color:var(--sp-text);}
.spl-owner.is-pref{font-weight:800;}
.spl-pref{display:inline-flex;color:var(--sp-accent);}
.spl-pref svg{width:12px;height:12px;}
.spl-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}
/* Panneau : posé juste sous la jaquette (margin-top en % = % de la largeur ; la jaquette fait 150 % de sa largeur) */
.spl-panel{position:absolute;top:0;left:0;right:0;margin-top:150%;padding-top:10px;cursor:pointer;visibility:hidden;pointer-events:none;transition:visibility 0s linear .2s;}
${both('.spl-panel')}{visibility:visible;pointer-events:auto;}
${H} .spl-panel{transition-delay:${DELAY};}
${F} .spl-panel{transition-delay:0s;}
/* Fond de la carte agrandie : passe derrière la jaquette (z-index -1 dans le contexte de .spl-tcard) */
.spl-surface{position:absolute;z-index:-1;top:0;left:-7px;right:-7px;bottom:-9px;margin-top:calc(-150% - 7px);border-radius:calc(var(--sp-r-cover) + 5px);background:var(--sp-surface);box-shadow:0 0 0 2px var(--sp-accent),0 18px 40px rgba(0,0,0,.55);opacity:0;transition:opacity .18s ease 0s;}
.spl-oled .spl-surface{box-shadow:var(--sp-glow);outline:2px solid var(--sp-accent);outline-offset:0;}
${both('.spl-surface')}{opacity:1;}
${H} .spl-surface{transition-delay:${DELAY};}
.spl-panel-in{display:flex;flex-direction:column;gap:6px;min-width:0;opacity:0;transform:translateY(-4px);transition:opacity .14s ease 0s,transform .2s ease 0s;}
${both('.spl-panel-in')}{opacity:1;transform:none;}
${H} .spl-panel-in{transition-delay:.3s;}
@starting-style{
${both('.spl-panel')}{visibility:hidden;}
${both('.spl-surface')}{opacity:0;}
${both('.spl-panel-in')}{opacity:0;transform:translateY(-4px);}
}
.spl-pname{font-size:13.5px;font-weight:800;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;}
.spl-pline{font-size:12px;line-height:1.35;color:var(--sp-text);min-width:0;}
.spl-pline b{font-weight:700;}
.spl-pmuted{color:var(--sp-muted);}
.spl-pactions{display:flex;gap:6px;margin-top:4px;min-width:0;}
@media (prefers-reduced-motion:reduce){.spl-tcard,.spl-surface,.spl-panel-in,.spl-meta{transition-duration:0s !important;}.spl-panel-in{transform:none !important;}}
.spl-side{position:relative;display:flex;align-items:center;gap:10px;width:100%;min-height:36px;padding:6px 10px;border:0;border-radius:var(--sp-r-sm);background:transparent;color:var(--sp-text);text-align:left;font-size:14px;}
.spl-side:hover{background:var(--sp-surface2);}
.spl-side[aria-current="true"]{font-weight:700;}
.spl-side[aria-current="true"]:hover{background:transparent;}
/* Pastille de la vue choisie (Sidebar dans Parts.tsx) : glisse d'une entrée à l'autre */
.spl-side-ind{position:absolute;top:0;left:14px;right:14px;height:36px;border-radius:var(--sp-r-sm);background:var(--sp-surface2);opacity:0;pointer-events:none;}
.spl-oled .spl-side-ind{box-shadow:inset 0 0 0 1px var(--sp-line);}
.spl-ind-ready > .spl-side-ind{transition:transform .26s cubic-bezier(.2,.8,.2,1),height .26s cubic-bezier(.2,.8,.2,1),opacity .2s;}
/* Changement de vue : le contenu arrive dans le sens de la colonne de gauche (d'en dessous en descendant, d'au-dessus en remontant) */
.spl-view-down{animation:spl-view-down .28s cubic-bezier(.2,.8,.2,1) both;}
.spl-view-up{animation:spl-view-up .28s cubic-bezier(.2,.8,.2,1) both;}
@keyframes spl-view-down{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:none;}}
@keyframes spl-view-up{from{opacity:0;transform:translateY(-18px);}to{opacity:1;transform:none;}}
@media (prefers-reduced-motion:reduce){.spl-ind-ready > .spl-side-ind{transition:opacity .14s;}.spl-view-down,.spl-view-up{animation:spl-view-fade .14s linear both;}}
@keyframes spl-view-fade{from{opacity:0;}to{opacity:1;}}
.spl-side > .spl-count{margin-left:auto;font-size:12px;color:var(--sp-muted);font-variant-numeric:tabular-nums;font-weight:600;}
/* Reprendre : au survol, contour à l'accent et image qui avance légèrement ; la carte ne bouge pas (le bouton Jouer reste sous le curseur) */
.spl-resume{position:relative;transition:box-shadow .22s ease,border-color .22s ease;}
/* Contour de 2 px à l'accent, comme les tuiles : la bordure de 1 px plus une ombre pleine de 1 px (rien ne bouge), placée avant l'ombre portée pour passer dessus */
.spl-resume:hover,.spl-resume:has(:focus-visible){box-shadow:0 0 0 1px var(--sp-accent),0 18px 42px rgba(0,0,0,.45);border-color:var(--sp-accent);}
.spl-resume-img{display:block;width:100%;padding:0;border:0;background:var(--sp-surface2);overflow:hidden;}
.spl-resume-img img{display:block;width:100%;aspect-ratio:460/215;object-fit:cover;transition:transform .35s cubic-bezier(.2,.8,.3,1),filter .2s ease;}
.spl-resume:hover .spl-resume-img img{transform:scale(1.04);filter:brightness(1.08);}
@media (prefers-reduced-motion:reduce){.spl-resume,.spl-resume-img img{transition:none;}.spl-resume:hover .spl-resume-img img{transform:none;}}
`;
