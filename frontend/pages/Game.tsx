// Fiche d'un jeu : /steamupgraded/app/:appid
import { useEffect, useState } from 'react';
import { PlayControl } from './game/PlayControl';
import { gameSize, hereLabel, sizeLabel } from '../core/machines';
import type { CSSProperties } from 'react';
import { heroUrl, lenderOf, logoUrl, openProperties, openStorePage } from '../core/steam';
import { useSettings } from '../core/settings';
import { useArt } from '../core/art';
import { openArtworkDialog } from '../features/sgdb';
import { heroCandidates, isShortcut, liveName, logoCandidates, useAchievements, useFriendsWithGame, useGame, useLenders, usePlaytimeLog, useRouteAppId } from './game/data';
import { CollectionsCard, FriendsCard, KeyCard, PlaytimeCard, ProgressCard } from './game/cards';
import { NewsSection } from './game/NewsSection';
import { usePageTransition } from '../core/transitions';

const icon = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

const Icons = {
	play: (
		<svg {...icon}>
			<path d="M7 4.5v15l12-7.5z" />
		</svg>
	),
	download: (
		<svg {...icon}>
			<path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
		</svg>
	),
	gear: (
		<svg {...icon}>
			<circle cx="12" cy="12" r="3" />
			<path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
		</svg>
	),
	store: (
		<svg {...icon}>
			<path d="M4 7h16l-1.5 12.5a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5z" />
			<path d="M9 10V6a3 3 0 0 1 6 0v4" />
		</svg>
	),
	disk: (
		<svg {...icon}>
			<ellipse cx="12" cy="6" rx="8" ry="3" />
			<path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
		</svg>
	),
	image: (
		<svg {...icon}>
			<rect x="3" y="4" width="18" height="16" rx="2" />
			<circle cx="9" cy="10" r="2" />
			<path d="m21 16-5-5-9 9" />
		</svg>
	),
};

// La règle .sp-root button{align-items:stretch} du thème décale le contenu des .sp-btn.
const btnAlign: CSSProperties = { alignItems: 'center' };

// Bouton discret posé sur la bannière (en haut à droite) : on ne s'en sert que de temps en temps.
const GAME_CSS = `
.spg-artwork{position:absolute;top:16px;right:16px;z-index:2;width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:var(--sp-r-sm);border:1px solid rgba(255,255,255,.18);background:rgba(10,12,16,.55);color:#f2f4f7;backdrop-filter:blur(8px);opacity:.8;transition:opacity .15s,border-color .15s;}
.spg-artwork:hover,.spg-artwork:focus-visible{opacity:1;border-color:var(--sp-accent);}
`;

/** Image qui essaie plusieurs adresses, puis signale l'échec. */
export function FallbackImg({ srcs, onFail, ...rest }: { srcs: string[]; onFail?: () => void } & Record<string, any>) {
	const [i, setI] = useState(0);
	useEffect(() => setI(0), [srcs.join('|')]);
	if (i >= srcs.length) return null;
	return (
		<img
			{...rest}
			src={srcs[i]}
			onError={() => {
				if (i + 1 >= srcs.length) onFail?.();
				setI(i + 1);
			}}
		/>
	);
}

function Hero({ app, oled }: { app: any; oled: boolean }) {
	const [heroFailed, setHeroFailed] = useState(false);
	const [logoFailed, setLogoFailed] = useState(false);
	useEffect(() => {
		setHeroFailed(false);
		setLogoFailed(false);
	}, [app.appid]);
	const shortcut = isShortcut(app.appid);
	// Visuel personnalisé d'abord (s'il existe), puis ceux de Steam
	const customHero = useArt(app, 'hero', '');
	const customLogo = useArt(app, 'logo', '');
	const heroes = [customHero, ...(shortcut ? [] : heroCandidates(app, heroUrl(app)))].filter(Boolean);
	const logos = [customLogo, ...(shortcut ? [] : logoCandidates(app, logoUrl(app)))].filter(Boolean);
	useEffect(() => {
		setHeroFailed(false);
		setLogoFailed(false);
	}, [customHero, customLogo]);

	const frame: CSSProperties = oled
		? { margin: '20px 24px 0', borderRadius: 'var(--sp-r-lg)', border: '1px solid var(--sp-line)' }
		: { margin: 0 };

	return (
		<div style={{ position: 'relative', height: 'clamp(240px, 30vw, 420px)', overflow: 'hidden', background: 'var(--sp-surface)', ...frame }}>
			{!heroFailed && heroes.length > 0 && (
				<FallbackImg
					srcs={heroes}
					alt=""
					onFail={() => setHeroFailed(true)}
					style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
				/>
			)}
			{!oled && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, var(--sp-bg) 100%)' }} />}
			<button type="button" className="spg-artwork" aria-label="Personnaliser les visuels" title="Personnaliser les visuels" onClick={() => openArtworkDialog(app)}>
				{Icons.image}
			</button>
			<div style={{ position: 'absolute', left: oled ? 32 : 40, right: 40, bottom: oled ? 28 : 24, display: 'flex', alignItems: 'flex-end' }}>
				{!logoFailed && logos.length > 0 ? (
					<FallbackImg
						srcs={logos}
						alt={app.display_name}
						onFail={() => setLogoFailed(true)}
						style={{ maxWidth: 'min(42%, 520px)', maxHeight: 'clamp(90px, 11vw, 170px)', objectFit: 'contain', objectPosition: 'left bottom', filter: 'drop-shadow(0 4px 18px rgba(0,0,0,.55))' }}
					/>
				) : (
					<h1 className="sp-h1" style={{ fontSize: 'clamp(30px, 4vw, 52px)', lineHeight: 1.05, maxWidth: '70%', textShadow: '0 2px 16px rgba(0,0,0,.7)' }}>
						{app.display_name}
					</h1>
				)}
			</div>
		</div>
	);
}

function ActionBar({ app, details }: { app: any; details: any }) {
	const shortcut = isShortcut(app.appid);
	// Taille bien visible, avant comme après l'installation (espace nécessaire, puis espace occupé)
	const { bytes, dlc, installed } = gameSize(app, details);
	const size = sizeLabel(bytes);
	// Part des contenus additionnels, quand elle compte (plus d'un dixième)
	const extra = dlc > bytes / 10 ? ` (dont ${sizeLabel(dlc)} de contenus additionnels)` : '';
	const status = installed ? `Installé sur ${hereLabel()}` : size ? `Espace nécessaire pour l’installer${extra}` : 'Non installé';
	return (
		<div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '20px 40px 0' }}>
			<PlayControl app={app} big />
			<button type="button" className="sp-btn" onClick={() => openProperties(app)} style={btnAlign}>
				{Icons.gear}
				Propriétés
			</button>
			{!shortcut && (
				<button type="button" className="sp-btn" onClick={() => openStorePage(app.appid)} style={btnAlign}>
					{Icons.store}
					Page du magasin
				</button>
			)}
			<span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
				{size && (
					<span aria-hidden="true" style={{ width: 38, height: 38, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--sp-r-sm)', background: 'var(--sp-surface2)', border: '1px solid var(--sp-line)', color: installed ? 'var(--sp-accent)' : 'var(--sp-muted)' }}>
						{Icons.disk}
					</span>
				)}
				<span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
					{size && <span style={{ fontWeight: 800, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{size}</span>}
					<span className="sp-muted" style={{ fontSize: 12.5 }}>{status}</span>
				</span>
			</span>
		</div>
	);
}

export function GamePage(props: any) {
	const pageRef = usePageTransition();
	const appid = useRouteAppId(props);
	const settings = useSettings();
	const { app, details } = useGame(appid);
	const ach = useAchievements(appid);
	const [lendersVersion, setLendersVersion] = useState(0);
	const copies = useLenders(appid, lendersVersion);
	const friends = useFriendsWithGame(appid);
	const log = usePlaytimeLog(appid, app ? app.minutes_playtime_forever || 0 : undefined);

	if (!app) {
		return (
			<div className="sp-root" ref={pageRef} style={{ padding: 40 }}>
				<h1 className="sp-h1">Jeu introuvable</h1>
				<p className="sp-muted">{appid ? `Aucun jeu ${appid} dans votre bibliothèque.` : 'Identifiant de jeu manquant.'}</p>
			</div>
		);
	}

	const oled = settings.theme === 'oled';
	const member = lenderOf(app);
	const lender = member ? { ...member, name: liveName(member.accountId, member.name) } : null;
	const shortcut = isShortcut(appid);

	return (
		<div className="sp-root" ref={pageRef}>
			<style>{GAME_CSS}</style>
			<Hero app={app} oled={oled} />
			<ActionBar app={app} details={details} />
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, padding: '24px 40px 48px', alignItems: 'flex-start' }}>
				<div style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
					<PlaytimeCard app={app} log={log} borrowed={lender} />
					{!shortcut && <ProgressCard data={ach.data} loading={ach.loading} />}
				</div>
				<aside style={{ flex: '1 1 300px', maxWidth: 400, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
					{!shortcut && <KeyCard app={app} details={details} lender={lender} copies={copies} onCopiesChanged={() => setLendersVersion((v) => v + 1)} />}
					<CollectionsCard appid={appid} />
					{!shortcut && <FriendsCard friends={friends} />}
				</aside>
			</div>
			{/* Historique des mises à jour et actualités du jeu, sous les cartes */}
			{!shortcut && (
				<div style={{ padding: '0 40px 56px' }}>
					<NewsSection appid={appid} />
				</div>
			)}
		</div>
	);
}
