// Big Picture › lecteur de musique plein écran (/steamupgraded/bp/lecteur) : pilote le lecteur de Steam.
// A sur un bouton, LB/RB piste précédente/suivante, X lecture aléatoire ; la lecture continue en quittant l'écran.
import { DialogButton, Focusable, GamepadButton } from 'millennium';
import { clock, music, Repeat, usePosition } from '../features/music';
import { BpFrame, goBackBp, useClock } from './Frame';
import { AlbumCover, IconMusic, IconNext, IconPause, IconPlay, IconPrevious, IconRepeat, IconShuffle, IconVolume, openAlbum, playAlbumBp, useNowPlaying } from './music';

const REPEAT_LABEL: Record<number, string> = { [Repeat.None]: 'Ne pas répéter', [Repeat.All]: 'Répéter l’album', [Repeat.Once]: 'Répéter la piste' };

/** Bouton rond de taille fixe (il ne se déforme pas dans une rangée trop étroite). */
function Round({ size, label, pressed, primary, autoFocus, onClick, children }: { size: number; label: string; pressed?: boolean; primary?: boolean; autoFocus?: boolean; onClick: () => void; children: any }) {
	return (
		<DialogButton
			className={`spbp-round${primary ? ' spbp-round--primary' : ''}`}
			noFocusRing
			autoFocus={autoFocus}
			aria-label={label}
			aria-pressed={pressed}
			onClick={onClick}
			onOKActionDescription={label}
			style={{ ['--spbp-size' as any]: `${size}px` }}
		>
			{children}
		</DialogButton>
	);
}

export function BpPlayer() {
	const now = useNowPlaying();
	const time = useClock();
	const ms = usePosition(!!now?.playing);

	if (!now)
		return (
			<BpFrame header={false} onBack={goBackBp} info={<span>Lecteur de musique</span>}>
				<header style={{ display: 'flex', alignItems: 'center', padding: '34px 72px 0' }}>
					<span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sp-muted)' }}>Lecteur de musique</span>
					<span style={{ flex: 1 }} />
					<span className="spbp-clock">{time}</span>
				</header>
				<Focusable style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 24, padding: '80px 72px' }}>
					<span style={{ fontSize: 34, fontWeight: 800 }}>Aucune musique en cours</span>
					<span style={{ fontSize: 22, color: 'var(--sp-muted)' }}>Les bandes-son se trouvent dans la Bibliothèque, vue « Bandes-son ».</span>
					<DialogButton className="spbp-btn" noFocusRing autoFocus onClick={goBackBp} onOKActionDescription="Retour">
						Retour
					</DialogButton>
				</Focusable>
			</BpFrame>
		);

	const { pb, app, album, track, playing } = now;
	const total = album?.tracks.length || 0;
	const lengthMs = pb.lengthMs || (track ? track.seconds * 1000 : 0);
	const pct = lengthMs ? Math.min(100, (ms / lengthMs) * 100) : 0;
	const next = (album?.tracks || []).slice(pb.track + 1, pb.track + 6);
	const onButtonDown = (e: any) => {
		const b = e?.detail?.button;
		if (b === GamepadButton.BUMPER_LEFT) music.previous();
		if (b === GamepadButton.BUMPER_RIGHT) music.next();
	};
	const volume = (d: number) => music.volume(Math.max(0, Math.min(100, pb.volume + d)));

	return (
		<BpFrame
			header={false}
			onBack={goBackBp}
			secondary={{ label: pb.shuffle ? 'Aléatoire : activée' : 'Aléatoire', run: () => music.shuffle(!pb.shuffle) }}
			options={{ label: 'Page de l’album', run: () => openAlbum(pb.appid) }}
			info={<span>{app?.display_name || ''}</span>}
		>
			<Focusable onButtonDown={onButtonDown} style={{ position: 'relative', minHeight: 'calc(var(--spbp-height) - var(--spbp-footer) - 24px)', display: 'flex', flexDirection: 'column' }}>
				{/* pochette floutée en fond, atténuée vers les bords */}
				<div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
					<AlbumCover app={app} size={1100} radius={0} style={{ position: 'absolute', left: -120, top: -160, filter: 'blur(90px) saturate(1.2)', opacity: 0.4 }} />
					<div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, transparent 0%, var(--sp-bg) 85%), linear-gradient(to bottom, transparent 55%, var(--sp-bg) 100%)' }} />
				</div>

				<header style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '34px 72px 0' }}>
					<span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sp-muted)' }}>{playing ? 'En cours de lecture' : 'En pause'}</span>
					<span style={{ flex: 1 }} />
					<span className="spbp-clock">{time}</span>
				</header>

				<main style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', gap: 72, padding: '0 72px 60px' }}>
					{/* plus petite sur un écran peu haut (21:9) */}
					<AlbumCover app={app} size="clamp(280px, calc(var(--spbp-height) - 340px), 500px)" radius={40} style={{ boxShadow: '0 40px 100px rgba(0,0,0,.7)' }} />

					<section aria-label="Piste en cours" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
						{total > 0 && (
							<span style={{ fontSize: 20, color: 'var(--sp-muted)' }}>
								Piste {pb.track + 1} sur {total}
								{track && new Set(album!.tracks.map((t) => t.disc)).size > 1 ? ` · Disque ${track.disc}` : ''}
							</span>
						)}
						<h1 style={{ margin: 0, fontSize: 72, fontWeight: 800, lineHeight: 1.02, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as any}>{track?.name || app?.display_name}</h1>
						<span style={{ fontSize: 26, color: 'var(--sp-muted)' }}>{[app?.display_name, album?.artist].filter(Boolean).join(' · ')}</span>

						<div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 26, fontSize: 20, color: 'var(--sp-muted)', fontVariantNumeric: 'tabular-nums' }}>
							<span>{clock(ms / 1000)}</span>
							<span className="spbp-progress" role="progressbar" aria-label="Position dans la piste" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
								<i style={{ width: `${pct}%` }} />
								<b style={{ left: `${pct}%` }} />
							</span>
							<span>{clock(lengthMs / 1000)}</span>
						</div>

						{/* commandes de lecture, puis volume sur sa propre ligne (la colonne est étroite à côté d'« À suivre ») */}
						<Focusable flow-children="column" style={{ display: 'flex', flexDirection: 'column', gap: 22, marginTop: 24 }}>
							<Focusable flow-children="row" style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
								<Round size={72} label="Lecture aléatoire" pressed={pb.shuffle} onClick={() => music.shuffle(!pb.shuffle)}>
									<IconShuffle size={26} />
								</Round>
								<Round size={84} label="Piste précédente" onClick={music.previous}>
									<IconPrevious size={30} />
								</Round>
								<Round size={112} label={playing ? 'Pause' : 'Lecture'} primary autoFocus onClick={music.toggle}>
									{playing ? <IconPause size={38} /> : <IconPlay size={38} />}
								</Round>
								<Round size={84} label="Piste suivante" onClick={music.next}>
									<IconNext size={30} />
								</Round>
								<Round size={72} label={REPEAT_LABEL[pb.repeat] || 'Répéter'} pressed={pb.repeat !== Repeat.None} onClick={() => music.cycleRepeat(pb.repeat)}>
									<IconRepeat size={26} once={pb.repeat === Repeat.Once} />
								</Round>
							</Focusable>
							<Focusable flow-children="row" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
								<Round size={60} label="Baisser le volume" onClick={() => volume(-10)}>
									<IconVolume size={22} muted={pb.volume === 0} />
								</Round>
								<span className="spbp-progress" role="meter" aria-label="Volume" aria-valuenow={pb.volume} aria-valuemin={0} aria-valuemax={100} style={{ width: 220, flex: 'none' }}>
									<i style={{ width: `${pb.volume}%`, background: 'var(--sp-text)' }} />
								</span>
								<Round size={60} label="Monter le volume" onClick={() => volume(10)}>
									<span style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>+</span>
								</Round>
							</Focusable>
						</Focusable>
					</section>

					<section aria-labelledby="spbp-next" style={{ width: 440, flex: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
						<h2 id="spbp-next" className="spbp-h2" style={{ fontSize: 24 }}>
							À suivre
						</h2>
						{next.length ? (
							<Focusable flow-children="column" className="spbp-tracklist">
								{next.map((t) => (
									<DialogButton key={t.index} className="spbp-track spbp-track--small" noFocusRing onClick={() => playAlbumBp(pb.appid, t.index)} onOKActionDescription="Lire la piste" aria-label={`${t.name}, ${clock(t.seconds)}`}>
										<span className="spbp-track-num">{t.number}</span>
										<span className="spbp-track-name">{t.name}</span>
										<span className="spbp-track-dur">{clock(t.seconds)}</span>
									</DialogButton>
								))}
							</Focusable>
						) : (
							<span style={{ fontSize: 20, color: 'var(--sp-muted)' }}>{total ? 'Dernière piste de l’album.' : ' '}</span>
						)}
						<DialogButton className="spbp-row spbp-row--card" noFocusRing onClick={() => openAlbum(pb.appid)} onOKActionDescription="Ouvrir">
							<IconMusic size={22} />
							Page de l’album
						</DialogButton>
					</section>
				</main>
			</Focusable>
		</BpFrame>
	);
}
