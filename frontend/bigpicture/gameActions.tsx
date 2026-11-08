// Briques communes aux écrans Big Picture qui montrent des jeux : visuels, actions, menu d'options (X).
import { useEffect, useState } from 'react';
import { Menu, MenuItem, MenuSeparator, showContextMenu } from 'millennium';
import { gameActions } from '../core/machines';
import { useArt } from '../core/art';
import { bpNavigate, bpWindow, coverUrl, heroUrl, landscapeUrl, ROUTES } from '../core/steam';
import { openArtworkDialog } from '../features/sgdb';
import { heroCandidates, isShortcut } from '../pages/game/data';
import { FallbackImg } from '../pages/Game';
import { isSoundtrack } from '../features/music';

/** Fiche du jeu, ou page de l'album pour une bande-son (jamais lancée comme un jeu). */
export function openGame(appid: number) {
	bpNavigate(isSoundtrack(appid) ? ROUTES.bpAlbum(appid) : ROUTES.bpApp(appid));
}

/** Propriétés du jeu : l'écran natif de Big Picture. */
export function openPropertiesBp(appid: number) {
	bpNavigate(`/app/${appid}/properties`);
}

/** Notre page de vente du jeu (StoreApp.tsx). */
export function openStoreBp(appid: number) {
	bpNavigate(ROUTES.bpStoreApp(appid));
}

export function openArtworkBp(app: any) {
	openArtworkDialog(app, bpWindow()?.document);
}

/** Élément d'ancrage d'un menu : il doit appartenir à la fenêtre Big Picture, sinon Steam ouvre
 * un menu de bureau, invisible ici. Les évènements manette n'ont pas toujours de currentTarget. */
function bpAnchor(anchor?: any): any {
	return anchor?.ownerDocument === bpWindow()?.document ? anchor : bpWindow()?.document?.querySelector('.gpfocus');
}

/** Menu manette natif, ancré dans la fenêtre Big Picture. */
export function showBpMenu(menu: any, anchor?: any) {
	try {
		showContextMenu(menu, bpAnchor(anchor));
	} catch (e) {
		console.error('[steam-upgraded] menu Big Picture impossible', e);
	}
}

/** Menu d'options d'un jeu (bouton X) : le menu manette natif de Big Picture. */
export function openGameOptions(app: any, anchor?: any) {
	if (!app) return;
	if (isSoundtrack(app.appid)) return openGame(app.appid);
	try {
		showContextMenu(
			<Menu label={app.display_name}>
				{(() => {
					// Jouer / installer / streamer : chaque possibilité s'il y a d'autres machines du compte (core/machines.ts)
					const acts = gameActions(app);
					return (acts.choices.length > 1 ? acts.choices : [acts.primary]).map((a, i) => (
						<MenuItem key={`act${i}`} disabled={a.disabled} onSelected={() => !a.disabled && a.run()}>
							{a.label}
						</MenuItem>
					));
				})()}
				<MenuItem onSelected={() => openGame(app.appid)}>Fiche du jeu</MenuItem>
				<MenuSeparator />
				<MenuItem onSelected={() => openPropertiesBp(app.appid)}>Propriétés</MenuItem>
				<MenuItem onSelected={() => openArtworkBp(app)}>Personnaliser les visuels…</MenuItem>
				{!isShortcut(app.appid) && <MenuItem onSelected={() => openStoreBp(app.appid)}>Page du magasin</MenuItem>}
			</Menu>,
			bpAnchor(anchor),
		);
	} catch (e) {
		console.error('[steam-upgraded] menu d’options Big Picture impossible', e);
	}
}

/** Bannière du jeu (visuel personnalisé d'abord), en fond plein cadre. */
export function HeroImage({ app, style }: { app: any; style?: any }) {
	const custom = useArt(app, 'hero', '');
	const srcs = [custom, ...(isShortcut(app.appid) ? [] : heroCandidates(app, heroUrl(app)))].filter(Boolean);
	return <FallbackImg srcs={srcs} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', ...style }} />;
}

/**
 * Jaquette verticale ; sans elle (aucune chez Steam pour certains jeux), l'en-tête du jeu sur un fond flou tiré de
 * lui-même, comme au bureau (pages/library/Grid.tsx) et comme le fait Steam.
 */
export function Cover({ app, className }: { app: any; className: string }) {
	const src = useArt(app, 'capsule', coverUrl(app));
	const [wide, setWide] = useState(false);
	useEffect(() => setWide(false), [src]);
	if (!wide || isShortcut(app.appid)) return <FallbackImg srcs={[src]} alt="" className={className} loading="lazy" onFail={() => setWide(true)} />;
	const header = landscapeUrl(app);
	return (
		<span className={className} style={{ position: 'relative', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
			<img src={header} alt="" loading="lazy" style={{ position: 'absolute', inset: '-15%', width: '130%', height: '130%', objectFit: 'cover', filter: 'blur(24px) brightness(.55)' }} />
			<img src={header} alt="" loading="lazy" style={{ position: 'relative', width: '100%', height: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,.45)' }} />
		</span>
	);
}

export function Landscape({ app, fallback, className }: { app: any; fallback: string; className: string }) {
	const src = useArt(app, 'header', fallback);
	return <FallbackImg srcs={[src, fallback]} alt="" className={className} loading="lazy" />;
}
