// Lecteur de musique : barre flottante en bas de la fenêtre, sur toutes les pages, tant qu'une bande-son est lancée.
// Il pilote le lecteur de Steam (SteamClient.Music) ; « Fermer » met en pause et masque la barre.
import { useEffect, useState } from 'react';
import { appById, navigate, ROUTES } from '../core/steam';
import { albumCovers, clock, music, Repeat, Status, useAlbum, usePlayback, usePosition } from '../features/music';
import { IconShuffle } from '../pages/Album';

const svg = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function Thumb({ app }: { app: any }) {
	const srcs = albumCovers(app);
	const [i, setI] = useState(0);
	useEffect(() => setI(0), [app?.appid]);
	const box = { width: 52, height: 52, flex: 'none', borderRadius: 12, background: 'var(--sp-surface2)' } as const;
	if (i >= srcs.length) return <span aria-hidden="true" style={box} />;
	return <img src={srcs[i]} alt="" onError={() => setI((n) => n + 1)} style={{ ...box, display: 'block', objectFit: 'cover' }} />;
}

export function MusicPlayer({ body }: { body: Element }) {
	const pb = usePlayback();
	const active = !!pb && pb.status !== Status.Idle;
	const pos = usePosition(active);
	const album = useAlbum(pb?.appid || 0);
	// « Fermer » : masqué jusqu'à la prochaine lecture
	const [closed, setClosed] = useState(false);
	const playing = pb?.status === Status.Playing;
	useEffect(() => {
		if (playing) setClosed(false);
	}, [playing, pb?.appid, pb?.track]);

	const shown = active && !closed;
	useEffect(() => {
		body.classList.toggle('sp-has-player', shown);
		return () => body.classList.remove('sp-has-player');
	}, [shown, body]);

	if (!pb || !shown) return null;
	const app = appById(pb.appid);
	const track = album?.tracks[pb.track];
	const lengthMs = pb.lengthMs || (track ? track.seconds * 1000 : 0);
	const repeatLabel = pb.repeat === Repeat.All ? 'Répéter l’album' : pb.repeat === Repeat.Once ? 'Répéter la piste' : 'Ne pas répéter';

	return (
		<div role="region" aria-label="Lecteur de musique" className="sp-player">
			<button type="button" className="sp-player-now" onClick={() => navigate(ROUTES.album(pb.appid))} aria-label={`Ouvrir l’album : ${app?.display_name || ''}`}>
				<Thumb app={app} />
				<span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
					<span className="sp-player-title">{track?.name || app?.display_name || ''}</span>
					<span className="sp-player-sub">{[app?.display_name, album?.artist].filter(Boolean).join(' · ')}</span>
				</span>
			</button>

			<div className="sp-player-mid">
				<div className="sp-player-ctrls">
					<button type="button" className="sp-player-btn" aria-label="Lecture aléatoire" aria-pressed={pb.shuffle} title="Lecture aléatoire" onClick={() => music.shuffle(!pb.shuffle)}>
						<IconShuffle />
					</button>
					<button type="button" className="sp-player-btn" aria-label="Piste précédente" onClick={music.previous}>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M18 5v14L8 12zM6 5h2v14H6z" />
						</svg>
					</button>
					<button type="button" className="sp-player-btn sp-player-main" aria-label={playing ? 'Pause' : 'Lecture'} onClick={music.toggle}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							{playing ? (
								<>
									<rect x="6" y="5" width="4" height="14" rx="1" />
									<rect x="14" y="5" width="4" height="14" rx="1" />
								</>
							) : (
								<path d="M7 4.5v15l12-7.5z" />
							)}
						</svg>
					</button>
					<button type="button" className="sp-player-btn" aria-label="Piste suivante" onClick={music.next}>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M6 5v14l10-7zM16 5h2v14h-2z" />
						</svg>
					</button>
					<button type="button" className="sp-player-btn" aria-label={repeatLabel} aria-pressed={pb.repeat !== Repeat.None} title={repeatLabel} onClick={() => music.cycleRepeat(pb.repeat)}>
						<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" {...svg}>
							<path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />
							{pb.repeat === Repeat.Once && <path d="M11 10.5l1.5-1v5" strokeWidth={1.8} />}
						</svg>
					</button>
				</div>
				<div className="sp-player-time">
					<span>{clock(pos / 1000)}</span>
					<input
						type="range"
						className="sp-range"
						min={0}
						max={Math.max(1, lengthMs)}
						step={1000}
						value={Math.min(pos, lengthMs)}
						aria-label="Position dans la piste"
						aria-valuetext={`${clock(pos / 1000)} sur ${clock(lengthMs / 1000)}`}
						onChange={(e) => music.seek(Number(e.target.value))}
						style={{ ['--sp-fill' as any]: `${lengthMs ? (Math.min(pos, lengthMs) / lengthMs) * 100 : 0}%` }}
					/>
					<span>{clock(lengthMs / 1000)}</span>
				</div>
			</div>

			<div className="sp-player-right">
				<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" {...svg}>
					<path d={pb.volume === 0 ? 'M11 5L6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6' : 'M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13'} />
				</svg>
				<input
					type="range"
					className="sp-range sp-range--soft"
					min={0}
					max={100}
					value={pb.volume}
					aria-label="Volume"
					onChange={(e) => music.volume(Number(e.target.value))}
					style={{ width: 110, ['--sp-fill' as any]: `${pb.volume}%` }}
				/>
				<button
					type="button"
					className="sp-player-btn"
					aria-label="Fermer le lecteur"
					title="Fermer le lecteur (met en pause)"
					onClick={() => {
						if (playing) music.toggle();
						setClosed(true);
					}}
				>
					<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" {...svg} strokeWidth={2.4}>
						<path d="M6 6l12 12M18 6L6 18" />
					</svg>
				</button>
			</div>
		</div>
	);
}
