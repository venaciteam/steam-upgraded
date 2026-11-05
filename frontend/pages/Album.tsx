// Page d'une bande-son : /steamupgraded/album/:appid (pochette, pistes par disque, écoute dans le lecteur de Steam).
import { useEffect, useState } from 'react';
import { Menu, MenuItem, MenuSeparator, showContextMenu } from 'millennium';
import { appById, navigate, openProperties, openStorePage, ROUTES } from '../core/steam';
import { usePath, currentPath } from '../core/history';
import { albumCovers, isAlbumInstalled, playAlbum, music, Status, totalLabel, clock, Track, useAlbum, usePlayback } from '../features/music';
import { Item, uninstall } from './library/menu';
import { usePageTransition } from '../core/transitions';

const w = window as any;

function useRouteAlbumId(props: any): number {
	const path = usePath();
	const fromProps = props?.match?.params?.appid;
	if (fromProps && /^\d+$/.test(String(fromProps))) return Number(fromProps);
	const m = (path || currentPath()).match(/\/steamupgraded\/album\/(\d+)/);
	return m ? Number(m[1]) : 0;
}

/** L'état d'installation change pendant un téléchargement : relu régulièrement. */
function useInstalled(app: any): boolean {
	const [on, set] = useState(isAlbumInstalled(app));
	useEffect(() => {
		set(isAlbumInstalled(app));
		const id = setInterval(() => set(isAlbumInstalled(app)), 2000);
		return () => clearInterval(id);
	}, [app]);
	return on;
}

function Cover({ app }: { app: any }) {
	const srcs = albumCovers(app);
	const [i, setI] = useState(0);
	useEffect(() => setI(0), [app?.appid]);
	const box = { width: '100%', aspectRatio: '1 / 1', borderRadius: 'var(--sp-r-lg)', boxShadow: '0 24px 60px rgba(0,0,0,.5)', background: 'var(--sp-surface2)' } as const;
	if (i >= srcs.length)
		return (
			<div aria-hidden="true" style={{ ...box, display: 'flex', alignItems: 'flex-end', padding: 22, fontWeight: 800, fontSize: 20, color: 'var(--sp-muted)' }}>
				{app?.display_name}
			</div>
		);
	return <img src={srcs[i]} alt="" onError={() => setI((n) => n + 1)} style={{ ...box, display: 'block', objectFit: 'cover' }} />;
}

const IconPlay = ({ size = 15 }: { size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path d="M7 4.5v15l12-7.5z" />
	</svg>
);

export const IconShuffle = () => (
	<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
	</svg>
);

/** Petites barres d'égaliseur : piste en cours de lecture. */
export const IconNowPlaying = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="En cours de lecture">
		<rect x="4" y="10" width="3" height="10" rx="1" />
		<rect x="10.5" y="5" width="3" height="15" rx="1" />
		<rect x="17" y="8" width="3" height="12" rx="1" />
	</svg>
);

function moreMenu(e: any, app: any, installed: boolean) {
	showContextMenu(
		<Menu label={app.display_name}>
			<MenuItem onSelected={() => openStorePage(app.appid)}>
				<Item icon="store" label="Page du magasin" />
			</MenuItem>
			<MenuItem onSelected={() => openProperties(app)}>
				<Item icon="gear" label="Propriétés…" />
			</MenuItem>
			{installed && <MenuSeparator />}
			{installed && (
				<MenuItem onSelected={() => uninstall(app.appid)}>
					<Item icon="trash" label="Désinstaller…" kind="danger" />
				</MenuItem>
			)}
		</Menu>,
		e.currentTarget || e,
	);
}

function TrackRow({ t, current, playing, installed, onPlay }: { t: Track; current: boolean; playing: boolean; installed: boolean; onPlay: () => void }) {
	return (
		<li>
			<button
				type="button"
				className="spa-track"
				aria-current={current ? 'true' : undefined}
				disabled={!installed}
				onClick={onPlay}
				aria-label={`${current && playing ? 'En cours de lecture : ' : 'Écouter : '}${t.name}, ${clock(t.seconds)}`}
			>
				<span className="spa-num">
					{current ? <IconNowPlaying /> : <span>{t.number}</span>}
					{!current && installed && (
						<span className="spa-num-play">
							<IconPlay size={12} />
						</span>
					)}
				</span>
				<span className="spa-name">{t.name}</span>
				<span className="spa-dur">{clock(t.seconds)}</span>
			</button>
		</li>
	);
}

const ALBUM_CSS = `
.spa-track{display:flex;align-items:center;gap:14px;width:100%;height:46px;padding:0 14px;border:0;border-radius:var(--sp-r-sm);background:transparent;color:var(--sp-text);text-align:left;font-size:14px;}
.spa-track:not(:disabled):hover{background:var(--sp-surface2);}
.spa-track:disabled{cursor:default;}
.spa-track[aria-current="true"]{background:var(--sp-surface2);color:var(--sp-accent);font-weight:800;}
.spa-num{position:relative;width:26px;display:flex;justify-content:flex-end;color:var(--sp-muted);font-variant-numeric:tabular-nums;flex:none;}
.spa-track[aria-current="true"] .spa-num{color:var(--sp-accent);}
.spa-num-play{position:absolute;inset:0;display:none;align-items:center;justify-content:flex-end;color:var(--sp-text);}
.spa-track:not(:disabled):hover .spa-num > span:first-child{visibility:hidden;}
.spa-track:not(:disabled):hover .spa-num-play{display:flex;}
.spa-name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.spa-dur{font-size:13px;color:var(--sp-muted);font-variant-numeric:tabular-nums;font-weight:500;}
.sp-root .spa-track{align-items:center;}
`;

export function AlbumPage(props: any) {
	const pageRef = usePageTransition();
	const appid = useRouteAlbumId(props);
	const app = appById(appid);
	const album = useAlbum(appid);
	const pb = usePlayback();
	const installed = useInstalled(app);
	const here = pb?.appid === appid && pb.status !== Status.Idle;
	const parent = app?.optional_parent_app_id ? appById(app.optional_parent_app_id) : null;

	if (!app)
		return (
			<div className="sp-root" ref={pageRef} style={{ padding: 40 }}>
				<span className="sp-muted">Bande-son introuvable.</span>
			</div>
		);

	const discs = new Map<number, Track[]>();
	for (const t of album?.tracks || []) discs.set(t.disc, [...(discs.get(t.disc) || []), t]);

	const listen = () => (here ? music.toggle() : playAlbum(appid));
	const shuffle = () => {
		music.shuffle(true);
		playAlbum(appid);
	};

	return (
		<div className="sp-root" ref={pageRef}>
			<style>{ALBUM_CSS}</style>
			<main style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 48, width: '100%', maxWidth: 1360, margin: '0 auto', padding: '36px 40px 64px' }}>
				<section aria-label="Album" style={{ flex: '0 0 380px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 18, position: 'sticky', top: 36 }}>
					<Cover app={app} />
					<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
						<span className="sp-label">Bande-son</span>
						<h1 className="sp-h1" style={{ fontSize: 28, lineHeight: 1.15 }}>
							{app.display_name}
						</h1>
						{album?.artist && <span style={{ fontSize: 16, color: 'var(--sp-muted)' }}>{album.artist}</span>}
					</div>
					<div className="sp-muted" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', fontSize: 13 }}>
						{parent && (
							<span>
								Bande-son de{' '}
								<a onClick={() => navigate(ROUTES.app(parent.appid))} style={{ fontWeight: 700 }}>
									{parent.display_name}
								</a>
							</span>
						)}
						{album && album.tracks.length > 0 && (
							<span>
								<strong style={{ color: 'var(--sp-text)' }}>{album.tracks.length} piste{album.tracks.length > 1 ? 's' : ''}</strong> · {totalLabel(album.seconds)}
							</span>
						)}
					</div>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
						{installed ? (
							<button type="button" className="sp-btn sp-btn--primary" style={{ height: 46, padding: '0 22px', alignItems: 'center' }} onClick={listen}>
								{here && pb?.status === Status.Playing ? (
									<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
										<rect x="6" y="5" width="4" height="14" rx="1" />
										<rect x="14" y="5" width="4" height="14" rx="1" />
									</svg>
								) : (
									<IconPlay />
								)}
								{here ? (pb?.status === Status.Playing ? 'Pause' : 'Reprendre') : 'Écouter l’album'}
							</button>
						) : (
							<button type="button" className="sp-btn sp-btn--primary" style={{ height: 46, padding: '0 22px', alignItems: 'center' }} onClick={() => w.SteamClient.Installs.OpenInstallWizard([appid])}>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
									<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
								</svg>
								Télécharger l’album
							</button>
						)}
						{installed && (
							<button type="button" className="sp-btn sp-btn--icon" style={{ width: 46, height: 46, color: 'var(--sp-muted)', alignItems: 'center' }} aria-label="Lecture aléatoire" title="Lecture aléatoire" onClick={shuffle}>
								<IconShuffle />
							</button>
						)}
						<button type="button" className="sp-btn sp-btn--icon" style={{ width: 46, height: 46, color: 'var(--sp-muted)', alignItems: 'center' }} aria-label="Plus d’actions" aria-haspopup="menu" onClick={(e) => moreMenu(e, app, installed)}>
							<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
								<circle cx="5" cy="12" r="1.8" />
								<circle cx="12" cy="12" r="1.8" />
								<circle cx="19" cy="12" r="1.8" />
							</svg>
						</button>
					</div>
					{!installed && <span className="sp-muted" style={{ fontSize: 12.5 }}>Steam ne lit que les albums téléchargés.</span>}
				</section>

				<div style={{ flex: '1 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 26 }}>
					{album === undefined && <span className="sp-muted">Chargement des pistes…</span>}
					{album === null && <span className="sp-muted">Steam ne donne pas la liste des pistes de cet album.</span>}
					{[...discs.entries()].map(([disc, tracks]) => (
						<section key={disc} aria-labelledby={`spa-disc-${disc}`} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
							<h2 id={`spa-disc-${disc}`} className="sp-label" style={{ margin: 0 }}>
								Disque {disc} · {tracks.length} piste{tracks.length > 1 ? 's' : ''}
							</h2>
							<ol className="sp-card" style={{ margin: 0, padding: 6, listStyle: 'none' }}>
								{tracks.map((t) => (
									<TrackRow key={t.index} t={t} current={here && pb?.track === t.index} playing={pb?.status === Status.Playing} installed={installed} onPlay={() => playAlbum(appid, t.index)} />
								))}
							</ol>
						</section>
					))}
				</div>
			</main>
		</div>
	);
}
