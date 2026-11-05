// Big Picture › Médias (remplace /media, qui restait vide) : les captures d'écran enregistrées sur ce PC,
// par mois, filtrées par jeu (LB/RB). A affiche la capture en grand ; les flèches passent à la voisine.
import { useEffect, useMemo, useState } from 'react';
import { DialogButton, Focusable, GamepadButton } from 'millennium';
import { appById } from '../core/steam';
import { plural } from '../pages/library/data';
import { BpFrame, goBackBp, useClock } from './Frame';
import { NowPlayingPill } from './music';
import { Glyph, GLYPH } from './Glyph';
import { openGame } from './gameActions';

const w = window as any;
const LOOPBACK = 'https://steamloopback.host/';

type Shot = { key: string; appid: number; created: number; full: string; thumb: string; width: number; height: number };

function useScreenshots(): { shots: Shot[] | null } {
	const [shots, set] = useState<Shot[] | null>(null);
	useEffect(() => {
		let alive = true;
		(async () => {
			try {
				const list: any[] = (await w.SteamClient.Screenshots.GetAllLocalScreenshots()) || [];
				if (!alive) return;
				set(
					list
						.filter((s) => s?.strUrl)
						.map((s) => ({
							key: `${s.nAppID}:${s.hHandle}`,
							appid: Number(s.nAppID),
							created: Number(s.nCreated || 0),
							full: LOOPBACK + s.strUrl,
							// Steam range une vignette à côté de chaque capture (screenshots/thumbnails/…)
							thumb: LOOPBACK + String(s.strUrl).replace('/screenshots/', '/screenshots/thumbnails/'),
							width: Number(s.nWidth || 0),
							height: Number(s.nHeight || 0),
						}))
						.sort((a, b) => b.created - a.created),
				);
			} catch (e) {
				console.error('[steam-upgraded] captures indisponibles', e);
				if (alive) set([]);
			}
		})();
		return () => {
			alive = false;
		};
	}, []);
	return { shots };
}

function gameName(appid: number): string {
	return appById(appid)?.display_name || `Jeu ${appid}`;
}

function monthLabel(rt: number): string {
	const s = new Date(rt * 1000).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
	return s.charAt(0).toUpperCase() + s.slice(1);
}

function dayLabel(rt: number): string {
	return new Date(rt * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

export function BpMedia() {
	const { shots } = useScreenshots();
	const clock = useClock();
	const [game, setGame] = useState(0);
	const [viewer, setViewer] = useState(false);
	const [current, setCurrent] = useState<Shot | null>(null);

	const games = useMemo(() => {
		const count = new Map<number, number>();
		for (const s of shots || []) count.set(s.appid, (count.get(s.appid) || 0) + 1);
		return [...count].sort((a, b) => b[1] - a[1]).map(([appid, n]) => ({ appid, n }));
	}, [shots]);
	const filters = [{ appid: 0, n: shots?.length || 0 }, ...games];
	const shown = (shots || []).filter((s) => !game || s.appid === game);
	const months: { label: string; list: Shot[] }[] = [];
	for (const s of shown) {
		const label = monthLabel(s.created);
		const last = months[months.length - 1];
		if (last?.label === label) last.list.push(s);
		else months.push({ label, list: [s] });
	}
	const index = current ? shown.findIndex((s) => s.key === current.key) : -1;

	const step = (d: number) => {
		const i = filters.findIndex((f) => f.appid === game);
		const next = filters[i + d];
		if (next) {
			setGame(next.appid);
			setViewer(false);
		}
	};
	const onButtonDown = (e: any) => {
		const b = e?.detail?.button;
		if (b === GamepadButton.BUMPER_LEFT) step(-1);
		if (b === GamepadButton.BUMPER_RIGHT) step(1);
	};

	return (
		<BpFrame
			header={false}
			onBack={viewer ? () => setViewer(false) : goBackBp}
			backLabel={viewer ? 'Fermer' : 'Retour'}
			secondary={current ? { label: 'Fiche du jeu', run: () => openGame(current.appid) } : undefined}
			info={<span>{shots ? `${plural(shown.length, 'capture', 'captures')}${game ? ` · ${gameName(game)}` : ''}` : 'Chargement des captures…'}</span>}
		>
			<Focusable onButtonDown={onButtonDown} style={{ display: 'flex', flexDirection: 'column' }}>
				<header style={{ display: 'flex', alignItems: 'center', gap: 28, padding: '34px 72px 0' }}>
					<h1 style={{ margin: 0, fontSize: 44, fontWeight: 800 }}>Médias</h1>
					<span style={{ fontSize: 20, color: 'var(--sp-muted)' }}>Captures d’écran enregistrées sur ce PC</span>
					<span style={{ flex: 1 }} />
					<NowPlayingPill />
					<span className="spbp-clock">{clock}</span>
				</header>

				{filters.length > 2 && (
					<nav aria-label="Jeux" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '26px 72px 0', flexWrap: 'wrap' }}>
						{filters.map((f) => (
							<span key={f.appid} className="spbp-pill-static" aria-current={f.appid === game ? 'true' : undefined}>
								{f.appid ? gameName(f.appid) : 'Tout'} · {f.n}
							</span>
						))}
						<span style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, color: 'var(--sp-muted)' }}>
							<Glyph button={GLYPH.LB} size={30} fallback="LB" />
							<Glyph button={GLYPH.RB} size={30} fallback="RB" />
							pour changer
						</span>
					</nav>
				)}

				{shots && !shots.length && <p style={{ margin: '50px 72px', fontSize: 26, color: 'var(--sp-muted)' }}>Aucune capture d’écran sur ce PC pour l’instant.</p>}

				<div key={game} style={{ display: 'flex', flexDirection: 'column', gap: 30, padding: '28px 72px 0' }}>
					{months.map((m, mi) => (
						<section key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
							<h2 className="spbp-h2" style={{ fontSize: 26 }}>
								{m.label} <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--sp-muted)' }}>{m.list.length}</span>
							</h2>
							<Focusable flow-children="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '24px 24px' }}>
								{m.list.map((s, i) => (
									<DialogButton
										key={s.key}
										className="spbp-result"
										noFocusRing
										autoFocus={mi === 0 && i === 0}
										onClick={() => setViewer((v) => !v)}
										onGamepadFocus={() => setCurrent(s)}
										onOKActionDescription={viewer ? 'Fermer' : 'Voir en grand'}
										aria-label={`${gameName(s.appid)}, ${dayLabel(s.created)}`}
									>
										{/* vignette de Steam (petite) ; l'image complète pour la capture focalisée */}
										<img src={current?.key === s.key ? s.full : s.thumb} alt="" loading="lazy" className="spbp-result-img" style={{ aspectRatio: '16 / 9' }} onError={(e) => ((e.currentTarget as HTMLImageElement).src = s.full)} />
										<span className="spbp-result-name">{gameName(s.appid)}</span>
										<span className="spbp-result-sub">{dayLabel(s.created)}</span>
									</DialogButton>
								))}
							</Focusable>
						</section>
					))}
				</div>
			</Focusable>

			{viewer && current && (
				<div className="spbp-viewer" aria-live="polite">
					<img src={current.full} alt="" />
					<span className="spbp-viewer-count">
						{gameName(current.appid)} · {dayLabel(current.created)} · {index + 1} sur {shown.length}
					</span>
				</div>
			)}
		</BpFrame>
	);
}
