// Big Picture › bandes-son : éléments communs à la page d'un album, au lecteur et aux en-têtes.
// Données et commandes partagées avec le bureau : features/music.ts.
import { appById, bpNavigate, ROUTES } from '../core/steam';
import { isSoundtrack, Status, useAlbum, useAlbumCover, usePlayback } from '../features/music';

const w = window as any;

/** Lance l'album dans le lecteur de Steam, à partir d'une piste (index à partir de 0) si elle est donnée.
 * (La version du bureau passe par la fenêtre du bureau, absente en Big Picture.) */
export function playAlbumBp(appid: number, index?: number) {
	w.SteamClient?.URL?.ExecuteSteamURL?.(`steam://musicplayer/playappalbum/${appid}${index !== undefined ? `/${index + 1}` : ''}`);
}

export function openAlbum(appid: number) {
	bpNavigate(ROUTES.bpAlbum(appid));
}

export function openPlayer() {
	bpNavigate(ROUTES.bpPlayer);
}

export { isSoundtrack };

/** Pochette carrée : copie locale de Steam, puis celle du magasin, puis le nom de l'album.
 * Réduite avant affichage (les originaux, jusqu'à 3000 px, restaient parfois gris dans une grille) :
 * deux fois la taille demandée en pixels, 768 px pour une taille relative (grille, clamp). */
export function AlbumCover({ app, size, radius, style }: { app: any; size: number | string; radius: number; style?: any }) {
	const px = typeof size === 'number' ? Math.min(1024, Math.max(128, Math.round(size * 2))) : 768;
	const { src, failed } = useAlbumCover(app, px);
	const box = { width: size, height: size, flex: 'none', borderRadius: radius, background: 'var(--sp-surface2)', ...style } as const;
	if (failed)
		return (
			<span aria-hidden="true" style={{ ...box, display: 'flex', alignItems: 'flex-end', padding: 22, boxSizing: 'border-box', fontWeight: 800, fontSize: 22, color: 'var(--sp-muted)' }}>
				{app?.display_name}
			</span>
		);
	return src ? <img src={src} alt="" style={{ ...box, display: 'block', objectFit: 'cover' }} /> : <span aria-hidden="true" style={{ ...box, display: 'block' }} />;
}

/** Lecture en cours (piste et album), ou null si le lecteur de Steam est arrêté. */
export function useNowPlaying() {
	const pb = usePlayback();
	const active = !!pb && pb.status !== Status.Idle;
	const album = useAlbum(active ? pb!.appid : 0);
	if (!active) return null;
	return { pb: pb!, app: appById(pb!.appid), album, track: album?.tracks[pb!.track], playing: pb!.status === Status.Playing };
}

/** Pastille de l'en-tête pendant la lecture : pochette, égaliseur et titre de la piste. */
export function NowPlayingPill() {
	const now = useNowPlaying();
	if (!now) return null;
	const title = now.track?.name || now.app?.display_name || '';
	return (
		<span className="spbp-chip" role="status" aria-label={`${now.playing ? 'En cours de lecture' : 'En pause'} : ${title}`} style={{ gap: 12, paddingLeft: 8 }}>
			<AlbumCover app={now.app} size={34} radius={17} style={{ cornerShape: 'round' }} />
			{now.playing ? <IconNowPlaying size={18} /> : <IconPause size={16} />}
			<span style={{ color: 'var(--sp-text)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
		</span>
	);
}

/** Une bande-son ne s'ouvre jamais comme un jeu : sa page d'album. */
export function soundtrackRoute(appid: number | string): string | null {
	return isSoundtrack(Number(appid)) ? ROUTES.bpAlbum(appid) : null;
}

// ---------- Pictogrammes ----------

export const IconPlay = ({ size = 20 }: { size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path d="M7 4.5v15l12-7.5z" />
	</svg>
);

export const IconPause = ({ size = 20 }: { size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<rect x="6" y="5" width="4" height="14" rx="1" />
		<rect x="14" y="5" width="4" height="14" rx="1" />
	</svg>
);

export const IconPrevious = ({ size = 28 }: { size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path d="M18 5v14L8 12zM6 5h2v14H6z" />
	</svg>
);

export const IconNext = ({ size = 28 }: { size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path d="M6 5v14l10-7zM16 5h2v14h-2z" />
	</svg>
);

export const IconShuffle = ({ size = 24 }: { size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
	</svg>
);

export const IconRepeat = ({ size = 24, once }: { size?: number; once?: boolean }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />
		{once && <path d="M11 10.5l1.5-1v5" strokeWidth={1.8} />}
	</svg>
);

export const IconMusic = ({ size = 24 }: { size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d="M9 18V5l12-2v13" />
		<circle cx="6" cy="18" r="3" />
		<circle cx="18" cy="16" r="3" />
	</svg>
);

export const IconVolume = ({ size = 26, muted }: { size?: number; muted?: boolean }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d={muted ? 'M11 5L6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6' : 'M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13'} />
	</svg>
);

/** Petites barres d'égaliseur : piste en cours de lecture. */
export const IconNowPlaying = ({ size = 22 }: { size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="var(--sp-accent)" role="img" aria-label="En cours de lecture">
		<rect x="4" y="10" width="3" height="10" rx="1" />
		<rect x="10.5" y="5" width="3" height="15" rx="1" />
		<rect x="17" y="8" width="3" height="12" rx="1" />
	</svg>
);

export const IconDownload = ({ size = 22 }: { size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
		<path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
	</svg>
);
