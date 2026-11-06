// Big Picture › page d'une bande-son (/steamupgraded/bp/album/:appid) : pochette, pistes, lecture dans le
// lecteur de Steam. Une bande-son ne s'ouvre jamais comme un jeu (pas de « Jouer »). A lit la piste, X lance
// la lecture aléatoire, Y ouvre le lecteur.
import { useEffect, useRef, useState } from 'react';
import { DialogButton, Focusable } from 'millennium';
import { appById } from '../core/steam';
import { usePath } from '../core/history';
import { clock, isAlbumInstalled, music, Status, totalLabel, useAlbum, usePlayback } from '../features/music';
import type { Track } from '../features/music';
import { plural } from '../pages/library/data';
import { BpFrame, goBackBp, useClock } from './Frame';
import { openGame } from './gameActions';
import { openInstallWizard } from '../core/machines';
import { AlbumCover, IconDownload, IconMusic, IconNowPlaying, IconPause, IconPlay, IconShuffle, NowPlayingPill, openPlayer, playAlbumBp } from './music';

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

function TrackRow({ t, current, playing, installed, focus, onPlay }: { t: Track; current: boolean; playing: boolean; installed: boolean; focus: boolean; onPlay: () => void }) {
	return (
		<DialogButton
			className="spbp-track"
			noFocusRing
			autoFocus={focus}
			aria-current={current ? 'true' : undefined}
			disabled={!installed}
			onClick={onPlay}
			onOKActionDescription="Lire la piste"
			aria-label={`${current && playing ? 'En cours de lecture : ' : ''}${t.name}, ${clock(t.seconds)}`}
		>
			<span className="spbp-track-num">{current && playing ? <IconNowPlaying /> : t.number}</span>
			<span className="spbp-track-name">{t.name}</span>
			<span className="spbp-track-dur">{clock(t.seconds)}</span>
		</DialogButton>
	);
}

export function BpAlbum() {
	const path = usePath('bp');
	const lastAppid = useRef(0);
	const fromPath = Number(path.match(/\/steamupgraded\/bp\/album\/(\d+)/)?.[1] || 0);
	if (fromPath) lastAppid.current = fromPath;
	const appid = lastAppid.current;
	const app = appById(appid);
	const album = useAlbum(appid);
	const pb = usePlayback();
	const installed = useInstalled(app);
	const time = useClock();
	const here = !!pb && pb.appid === appid && pb.status !== Status.Idle;
	const playing = here && pb!.status === Status.Playing;
	const parent = app?.optional_parent_app_id ? appById(app.optional_parent_app_id) : null;

	const discs = new Map<number, Track[]>();
	for (const t of album?.tracks || []) discs.set(t.disc, [...(discs.get(t.disc) || []), t]);
	const manyDiscs = discs.size > 1;

	const listen = () => (here ? music.toggle() : playAlbumBp(appid));
	const shuffle = () => {
		music.shuffle(true);
		playAlbumBp(appid);
	};
	const download = () => openInstallWizard([appid]);
	const facts = [album && album.tracks.length ? `${plural(album.tracks.length, 'piste', 'pistes')} · ${totalLabel(album.seconds)}` : ''].filter(Boolean).join('');

	return (
		<BpFrame
			header={false}
			onBack={goBackBp}
			secondary={installed ? { label: 'Lecture aléatoire', run: shuffle } : undefined}
			options={{ label: 'Lecteur', run: openPlayer }}
			info={<span>{here && album?.tracks[pb!.track] ? `Piste ${pb!.track + 1} en cours · ${album.tracks[pb!.track].name}` : app?.display_name || 'Bande-son'}</span>}
		>
			<header style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '28px 72px 0' }}>
				<span style={{ fontSize: 19, fontWeight: 700, color: 'var(--sp-muted)' }}>Bibliothèque · Bandes-son</span>
				<span style={{ flex: 1 }} />
				<NowPlayingPill />
				<span className="spbp-clock">{time}</span>
			</header>

			{!app ? (
				<p style={{ margin: '50px 72px', fontSize: 26, color: 'var(--sp-muted)' }}>Bande-son introuvable.</p>
			) : (
				<Focusable flow-children="row" style={{ display: 'flex', alignItems: 'flex-start', gap: 64, padding: '28px 72px 0' }}>
					<section aria-label="Album" style={{ width: 440, flex: 'none', display: 'flex', flexDirection: 'column', gap: 18, position: 'sticky', top: 28 }}>
						{/* pochette réduite sur un écran peu haut (21:9) : les boutons restent visibles sans défiler */}
						<AlbumCover app={app} size="clamp(220px, calc(var(--spbp-height) - 540px), 380px)" radius={32} style={{ boxShadow: '0 30px 80px rgba(0,0,0,.6)' }} />
						<span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
							<span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sp-accent)' }}>Bande-son</span>
							<h1 style={{ margin: 0, fontSize: 36, fontWeight: 800, lineHeight: 1.1 }}>{app.display_name}</h1>
							{album?.artist && <span style={{ fontSize: 21, color: 'var(--sp-muted)' }}>{album.artist}</span>}
						</span>
						{(parent || facts) && (
							<span style={{ fontSize: 18, color: 'var(--sp-muted)' }}>
								{parent && (
									<>
										Bande-son de <strong style={{ color: 'var(--sp-text)' }}>{parent.display_name}</strong>
										{facts ? ' · ' : ''}
									</>
								)}
								{facts}
							</span>
						)}
						<Focusable flow-children="row" style={{ display: 'flex', gap: 12 }}>
							{installed ? (
								<DialogButton className="spbp-btn spbp-btn--primary spbp-btn--compact" noFocusRing autoFocus={!here} onClick={listen} onOKActionDescription={here ? (playing ? 'Pause' : 'Reprendre') : 'Écouter'}>
									{playing ? <IconPause /> : <IconPlay />}
									{here ? (playing ? 'Pause' : 'Reprendre') : 'Écouter l’album'}
								</DialogButton>
							) : (
								<DialogButton className="spbp-btn spbp-btn--primary spbp-btn--compact" noFocusRing autoFocus onClick={download} onOKActionDescription="Télécharger">
									<IconDownload />
									Télécharger l’album
								</DialogButton>
							)}
							{installed && (
								<DialogButton className="spbp-btn spbp-btn--icon spbp-btn--compact" noFocusRing aria-label="Lecture aléatoire" onClick={shuffle} onOKActionDescription="Lecture aléatoire">
									<IconShuffle />
								</DialogButton>
							)}
							<DialogButton className="spbp-btn spbp-btn--icon spbp-btn--compact" noFocusRing aria-label="Ouvrir le lecteur" onClick={openPlayer} onOKActionDescription="Ouvrir le lecteur">
								<IconMusic />
							</DialogButton>
						</Focusable>
						{!installed && <span style={{ fontSize: 16, color: 'var(--sp-muted)' }}>Steam ne lit que les albums téléchargés.</span>}
					</section>

					<section aria-labelledby="spbp-tracks" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 22, paddingBottom: 140 }}>
						{album === undefined && <p style={{ margin: 0, fontSize: 22, color: 'var(--sp-muted)' }}>Chargement des pistes…</p>}
						{album === null && <p style={{ margin: 0, fontSize: 22, color: 'var(--sp-muted)' }}>Steam ne donne pas la liste des pistes de cet album.</p>}
						{[...discs.entries()].map(([disc, tracks], di) => (
							<div key={disc} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
								<h2 id={di === 0 ? 'spbp-tracks' : undefined} className="spbp-h2" style={{ fontSize: 24 }}>
									{di === 0 ? 'Pistes ' : ''}
									<span style={{ fontSize: 20, fontWeight: 600, color: 'var(--sp-muted)' }}>
										{manyDiscs ? `Disque ${disc} · ` : ''}
										{tracks.length}
									</span>
								</h2>
								<Focusable flow-children="column" className="spbp-tracklist">
									{tracks.map((t) => (
										<TrackRow
											key={t.index}
											t={t}
											current={here && pb!.track === t.index}
											playing={playing}
											installed={installed}
											focus={here && pb!.track === t.index}
											onPlay={() => playAlbumBp(appid, t.index)}
										/>
									))}
								</Focusable>
							</div>
						))}
						{parent && (
							<div style={{ display: 'flex' }}>
								<DialogButton className="spbp-row spbp-row--card" noFocusRing onClick={() => openGame(parent.appid)} onOKActionDescription="Fiche du jeu">
									Fiche de {parent.display_name}
								</DialogButton>
							</div>
						)}
					</section>
				</Focusable>
			)}
		</BpFrame>
	);
}
