// Petits composants de la page Bibliothèque : icônes, avatar, bouton Jouer.
import { useState } from 'react';
import { PlayControl } from '../game/PlayControl';
import type { Game, Person } from './data';

const svg = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const IconPlay = ({ size = 16 }: { size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...svg}>
		<path d="M7 4.5v15l12-7.5z" fill="currentColor" />
	</svg>
);

export const IconDownload = ({ size = 16 }: { size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...svg}>
		<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
	</svg>
);

export const IconSearch = () => (
	<svg width={17} height={17} viewBox="0 0 24 24" aria-hidden="true" {...svg}>
		<circle cx="11" cy="11" r="6.5" />
		<path d="M20 20l-4.2-4.2" />
	</svg>
);

export const IconClose = () => (
	<svg width={14} height={14} viewBox="0 0 24 24" aria-hidden="true" {...svg}>
		<path d="M6 6l12 12M18 6L6 18" />
	</svg>
);

export const IconChevron = () => (
	<svg width={14} height={14} viewBox="0 0 24 24" aria-hidden="true" {...svg}>
		<path d="M6 9l6 6 6-6" />
	</svg>
);

export const IconSort = () => (
	<svg width={16} height={16} viewBox="0 0 24 24" aria-hidden="true" {...svg}>
		<path d="M4 7h11M4 12h8M4 17h5M18 5v14M15 16l3 3 3-3" />
	</svg>
);

export const IconCheck = () => (
	<svg width={15} height={15} viewBox="0 0 24 24" aria-hidden="true" {...svg} strokeWidth={2.4}>
		<path d="M5 12.5l4.5 4.5L19 7.5" />
	</svg>
);

export const IconCopies = ({ size = 12 }: { size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...svg} strokeWidth={2.2}>
		<rect x="8" y="8" width="12" height="12" rx="2" />
		<path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
	</svg>
);

export function Avatar({ p, size = 26 }: { p: Person; size?: number }) {
	const [broken, setBroken] = useState(false);
	if (p.avatar && !broken)
		return (
			<img
				src={p.avatar}
				alt=""
				width={size}
				height={size}
				onError={() => setBroken(true)}
				style={{ width: size, height: size, borderRadius: '50%', flex: 'none', objectFit: 'cover', boxShadow: `0 0 0 2px ${p.color}` }}
			/>
		);
	return (
		<span aria-hidden="true" className="sp-avatar" style={{ width: size, height: size, background: p.color, fontSize: Math.round(size * 0.46) }}>
			{p.initial}
		</span>
	);
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
	return <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', background: color, flex: 'none', display: 'inline-block' }} />;
}

/** Bouton Jouer / Installer / Streamer (core/machines.ts), avec la flèche des autres machines s'il y en a. */
export function PlayButton({ g, compact, style }: { g: Game; compact?: boolean; style?: any }) {
	return <PlayControl app={g.app} name={g.name} compact={compact} style={style} />;
}
