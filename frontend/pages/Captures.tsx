// Page Captures (/steamupgraded/captures, remplace /media) : captures d'écran groupées par jour, filtre par jeu,
// panneau de la capture choisie (légende, publier, afficher, supprimer), et extraits vidéo.
import { useEffect, useMemo, useState } from 'react';
import { Menu, MenuItem, showContextMenu } from 'millennium';
import { appById } from '../core/steam';
import { plural } from './library/data';
import { usePageTransition } from '../core/transitions';

const w = window as any;
const LOOPBACK = 'https://steamloopback.host/';
const S = () => w.SteamClient.Screenshots;

type Shot = { app: number; game: string; handle: number; width: number; height: number; created: number; caption: string; uploaded: boolean; url: string; thumb: string };

function gameName(appid: number): string {
	return appById(appid)?.display_name || `Jeu ${appid}`;
}

async function loadShots(): Promise<Shot[]> {
	const n: number = (await S().GetAllAppsLocalScreenshotsCount()) || 0;
	const list: any[] = n ? (await S().GetAllAppsLocalScreenshotsRange(0, n)) || [] : [];
	return list
		.filter((s) => s?.strUrl)
		.map((s) => ({
			app: Number(s.nAppID),
			game: gameName(Number(s.nAppID)),
			handle: Number(s.hHandle),
			width: Number(s.nWidth) || 16,
			height: Number(s.nHeight) || 9,
			created: Number(s.nCreated) || 0,
			caption: String(s.strCaption || ''),
			uploaded: !!s.bUploaded,
			url: LOOPBACK + s.strUrl,
			thumb: LOOPBACK + String(s.strUrl).replace('/screenshots/', '/screenshots/thumbnails/'),
		}))
		.sort((a, b) => b.created - a.created);
}

const dayKey = (rt: number) => {
	const d = new Date(rt * 1000);
	return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

function dayLabel(rt: number): string {
	const d = new Date(rt * 1000);
	const today = new Date();
	const diff = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
	if (diff === 0) return 'Aujourd’hui';
	if (diff === 1) return 'Hier';
	return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: today.getFullYear() === d.getFullYear() ? undefined : 'numeric' });
}

const timeLabel = (rt: number) => {
	const d = new Date(rt * 1000);
	return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Image qui retombe sur l'image en taille réelle si la vignette manque. */
function Thumb({ s, style }: { s: Shot; style?: any }) {
	const [src, setSrc] = useState(s.thumb);
	useEffect(() => setSrc(s.thumb), [s.thumb]);
	return <img src={src} alt="" loading="lazy" decoding="async" draggable={false} onError={() => src !== s.url && setSrc(s.url)} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', ...style }} />;
}

// ---------- Extraits ----------

type Clip = { id: string; title: string; game: string; created: number };

function readClips(): Clip[] {
	const grs = w.g_GRS;
	const list: any[] = grs?.GetClipSummaries?.() || [];
	return list
		.map((c: any) => ({
			id: String(c.clip_id || ''),
			title: String(c.name || grs?.GetBestClipTitle?.(c.clip_id) || 'Extrait'),
			game: gameName(Number(c.game_id || c.app_id || 0)),
			created: Number(c.date_recorded || c.date_clipped || 0),
		}))
		.sort((a, b) => b.created - a.created);
}

function useClips(): Clip[] | null {
	const [clips, set] = useState<Clip[] | null>(null);
	useEffect(() => {
		try {
			w.g_GRS?.LazyLoadClips?.();
		} catch {}
		const tick = () => {
			try {
				if (!w.g_GRS?.BLoadingClips?.()) set(readClips());
			} catch {
				set([]);
			}
		};
		tick();
		const id = setInterval(tick, 1500);
		return () => clearInterval(id);
	}, []);
	return clips;
}

// ---------- Panneau de la capture choisie ----------

const PRIVACY = [
	{ value: 8, label: 'Publique' },
	{ value: 4, label: 'Visible par vos contacts' },
	{ value: 2, label: 'Privée' },
];

function Details({ s, onDeleted, onChanged }: { s: Shot; onDeleted: () => void; onChanged: () => void }) {
	const [caption, setCaption] = useState(s.caption);
	const [status, setStatus] = useState('');
	const [confirm, setConfirm] = useState(false);
	useEffect(() => {
		setCaption(s.caption);
		setStatus('');
		setConfirm(false);
	}, [s.handle, s.app]);

	const saveCaption = () => {
		if (caption === s.caption) return;
		w.SteamClient.Apps.SetLocalScreenshotCaption(String(s.app), s.handle, caption);
		onChanged();
	};

	const publish = (e: any) =>
		showContextMenu(
			<Menu label="Publier sur Steam">
				{PRIVACY.map((p) => (
					<MenuItem
						key={p.value}
						onSelected={async () => {
							saveCaption();
							setStatus('Publication…');
							const ok = await S().UploadLocalScreenshot(String(s.app), s.handle, p.value);
							setStatus(ok ? 'Publiée sur votre profil Steam.' : 'La publication a échoué.');
							onChanged();
						}}
					>
						{`Publier : ${p.label.toLowerCase()}`}
					</MenuItem>
				))}
			</Menu>,
			e.currentTarget,
		);

	const remove = async () => {
		setConfirm(false);
		const ok = await S().DeleteLocalScreenshot(String(s.app), s.handle);
		if (ok) onDeleted();
		else setStatus('La suppression a échoué.');
	};

	return (
		<aside aria-label="Capture sélectionnée" style={{ flex: 'none', width: 360, padding: '30px 24px', borderLeft: '1px solid var(--sp-line)', background: 'var(--sp-surface)', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
			<button type="button" onClick={() => S().ShowScreenshotInSystemViewer(String(s.app), s.handle)} aria-label="Afficher en grand" style={{ padding: 0, border: 0, background: 'transparent', borderRadius: 16, overflow: 'hidden', aspectRatio: `${s.width} / ${s.height}`, maxHeight: 360 }}>
				<img src={s.url} alt="" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
			</button>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
				<span style={{ fontWeight: 800, fontSize: 16 }}>{s.game}</span>
				<span className="sp-muted" style={{ fontSize: 13 }}>
					{dayLabel(s.created)} à {timeLabel(s.created)} · {s.width} × {s.height}
					{s.uploaded ? ' · publiée' : ''}
				</span>
			</div>
			<label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: 'var(--sp-muted)' }}>
				Légende
				<input className="sp-input" type="text" value={caption} placeholder="Ajouter une légende" onChange={(e) => setCaption(e.target.value)} onBlur={saveCaption} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
			</label>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
				{!s.uploaded && (
					<button type="button" className="sp-btn sp-btn--primary" aria-haspopup="menu" onClick={publish} style={{ height: 42, alignItems: 'center' }}>
						Publier sur Steam…
					</button>
				)}
				<button type="button" className="sp-btn" style={{ height: 42, alignItems: 'center' }} onClick={() => S().ShowScreenshotInSystemViewer(String(s.app), s.handle)}>
					Afficher en grand
				</button>
				<button type="button" className="sp-btn" style={{ height: 42, alignItems: 'center' }} onClick={() => S().ShowScreenshotsOnDisk(String(s.app))}>
					Afficher dans le dossier
				</button>
				{confirm ? (
					<div className="sp-card" role="alertdialog" aria-label="Supprimer la capture" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--sp-surface2)' }}>
						<span>Supprimer cette capture de ce PC ? Elle ne pourra pas être récupérée.</span>
						<div style={{ display: 'flex', gap: 8 }}>
							<button type="button" className="sp-btn" style={{ flex: 1, alignItems: 'center' }} onClick={() => setConfirm(false)}>
								Annuler
							</button>
							<button type="button" className="sp-btn" style={{ flex: 1, alignItems: 'center', color: 'var(--sp-busy)', borderColor: 'var(--sp-busy)' }} onClick={remove}>
								Supprimer
							</button>
						</div>
					</div>
				) : (
					<button type="button" className="sp-btn" style={{ height: 42, alignItems: 'center', color: 'var(--sp-busy)' }} onClick={() => setConfirm(true)}>
						Supprimer…
					</button>
				)}
			</div>
			{status && (
				<span role="status" className="sp-muted" style={{ fontSize: 13 }}>
					{status}
				</span>
			)}
		</aside>
	);
}

// ---------- Page ----------

export function CapturesPage() {
	const pageRef = usePageTransition();
	const [shots, setShots] = useState<Shot[] | null>(null);
	const [tab, setTab] = useState<'shots' | 'clips'>('shots');
	const [game, setGame] = useState<number>(0);
	const [sel, setSel] = useState<Shot | null>(null);
	const clips = useClips();

	const reload = () =>
		loadShots().then(
			(list) => {
				setShots(list);
				setSel((cur) => (cur ? list.find((x) => x.app === cur.app && x.handle === cur.handle) || null : null));
			},
			() => setShots([]),
		);
	useEffect(() => {
		reload();
	}, []);

	const games = useMemo(() => {
		const m = new Map<number, { app: number; name: string; n: number }>();
		for (const s of shots || []) {
			const g = m.get(s.app) || { app: s.app, name: s.game, n: 0 };
			g.n++;
			m.set(s.app, g);
		}
		return [...m.values()].sort((a, b) => b.n - a.n);
	}, [shots]);

	const shown = useMemo(() => (shots || []).filter((s) => !game || s.app === game), [shots, game]);
	const days = useMemo(() => {
		const out: { key: string; label: string; list: Shot[] }[] = [];
		for (const s of shown) {
			const k = dayKey(s.created);
			let d = out[out.length - 1];
			if (!d || d.key !== k) out.push((d = { key: k, label: dayLabel(s.created), list: [] }));
			d.list.push(s);
		}
		return out;
	}, [shown]);

	const total = shots?.length || 0;
	const published = (shots || []).filter((s) => s.uploaded).length;
	const summary = shots ? `${plural(total, 'capture', 'captures')} · ${plural(games.length, 'jeu', 'jeux')} · ${published ? plural(published, 'publiée', 'publiées') : 'aucune publiée'}` : 'Chargement…';

	return (
		<div className="sp-root" ref={pageRef} style={{ display: 'flex', overflow: 'hidden' }}>
			<main style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '30px 36px 48px', display: 'flex', flexDirection: 'column', gap: 22 }}>
				<div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
					<div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 4 }}>
						<h1 className="sp-h1">Captures</h1>
						<span className="sp-muted">{tab === 'shots' ? summary : clips === null ? 'Chargement…' : clips.length ? plural(clips.length, 'extrait', 'extraits') : 'Aucun extrait'}</span>
					</div>
					<div role="tablist" aria-label="Type" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 14, border: '1px solid var(--sp-line)' }}>
						{(
							[
								['shots', 'Captures d’écran'],
								['clips', 'Extraits'],
							] as const
						).map(([id, label]) => (
							<button key={id} type="button" role="tab" aria-selected={tab === id} className="sp-pill" onClick={() => setTab(id)} style={{ height: 34, border: 0, borderRadius: 10, padding: '0 14px', background: tab === id ? 'var(--sp-surface2)' : 'transparent', fontWeight: tab === id ? 800 : 600, color: tab === id ? 'var(--sp-text)' : 'var(--sp-muted)' }}>
								{label}
							</button>
						))}
					</div>
					{tab === 'shots' && games.length > 0 && (
						<button type="button" className="sp-btn" onClick={() => S().ShowScreenshotsOnDisk(String(game || games[0].app))}>
							Ouvrir le dossier
						</button>
					)}
				</div>

				{tab === 'shots' ? (
					<>
						{games.length > 1 && (
							<div role="group" aria-label="Filtrer par jeu" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
								{[{ app: 0, name: 'Tous les jeux', n: total }, ...games].map((g) => (
									<button key={g.app} type="button" className="sp-pill" aria-pressed={game === g.app} onClick={() => setGame(g.app)} style={{ height: 36, borderRadius: 18, padding: '0 14px' }}>
										{g.name}
										<span className="sp-muted" style={{ fontSize: 12 }}>
											{g.n}
										</span>
									</button>
								))}
							</div>
						)}
						{shots && !shots.length && (
							<div className="sp-card" style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
								<span style={{ fontWeight: 800 }}>Aucune capture d’écran</span>
								<span className="sp-muted">En jeu, la touche de capture (F12 par défaut, réglable dans Paramètres › Steam › En jeu) en prend une.</span>
							</div>
						)}
						{days.map((d) => (
							<section key={d.key} aria-label={d.label} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
								<h2 className="sp-label" style={{ margin: 0 }}>
									{d.label}
								</h2>
								<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
									{d.list.map((s) => {
										const on = sel?.app === s.app && sel.handle === s.handle;
										return (
											<button key={`${s.app}-${s.handle}`} type="button" aria-pressed={on} onClick={() => setSel(on ? null : s)} aria-label={`${s.game}, ${timeLabel(s.created)}`} style={{ padding: 0, border: 0, background: 'transparent', display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', alignItems: 'stretch' }}>
												<span style={{ display: 'block', aspectRatio: '16 / 9', borderRadius: 16, overflow: 'hidden', background: 'var(--sp-surface2)', outline: on ? '2px solid var(--sp-accent)' : 'none', outlineOffset: 2 }}>
													<Thumb s={s} />
												</span>
												<span className="sp-muted" style={{ fontSize: 12 }}>
													{s.game} · {timeLabel(s.created)}
												</span>
											</button>
										);
									})}
								</div>
							</section>
						))}
					</>
				) : clips === null ? null : clips.length ? (
					<div className="sp-card" style={{ padding: '4px 18px' }}>
						{clips.map((c, i) => (
							<div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 60, borderTop: i ? '1px solid var(--sp-line)' : 0 }}>
								<span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
									<span style={{ fontWeight: 700 }}>{c.title}</span>
									<span className="sp-muted" style={{ fontSize: 12 }}>
										{c.game}
										{c.created ? ` · ${dayLabel(c.created)} à ${timeLabel(c.created)}` : ''}
									</span>
								</span>
							</div>
						))}
					</div>
				) : (
					<div className="sp-card" style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
						<span style={{ fontWeight: 800 }}>Aucun extrait</span>
						<span className="sp-muted">L’enregistrement de vos parties se règle dans Paramètres › Steam › Enregistrement de jeu. Les extraits enregistrés apparaîtront ici.</span>
					</div>
				)}
			</main>
			{tab === 'shots' && sel && (
				<Details
					s={sel}
					onChanged={() => setTimeout(reload, 600)}
					onDeleted={() => {
						setSel(null);
						reload();
					}}
				/>
			)}
		</div>
	);
}
