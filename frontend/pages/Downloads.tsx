// Page Téléchargements (/steamupgraded/downloads, remplace /library/downloads) :
// le jeu en cours en grande carte, puis la file (en attente, planifiés) et les téléchargements terminés.
import { useEffect, useState } from 'react';
import { appById, landscapeUrl, navigate, ROUTES } from '../core/steam';
import { LOCAL_ID } from '../core/machines';
import { useArt } from '../core/art';
import { localOverview, speedLabel } from '../shell/Downloads';
import { openSteamSettings } from '../features/steamSettings';
import { plural } from './library/data';
import { IconClose } from './library/ui';
import { usePageTransition } from '../core/transitions';

const w = window as any;
/** Index de l'étape « téléchargement » dans les progressions de Steam (k_EAppUpdateProgress_Download). */
const DOWNLOAD = 2;

type Kind = 'queued' | 'paused' | 'scheduled' | 'done';

type Item = { appid: number; kind: Kind; install: boolean; bytes: number; done: number; when: number };

type Active = { appid: number; install: boolean; paused: boolean; pct: number; done: number; total: number; speed: number; seconds: number; started: number; history: number[] };

type State = { active: Active | null; items: Item[]; allPaused: boolean };

const D = () => w.SteamClient.Downloads;

function itemBytes(it: any): [number, number] {
	let done = 0;
	let total = 0;
	for (const u of it?.update_type_info || []) {
		done += Number(u?.progress?.[DOWNLOAD]?.bytes_in_progress || 0);
		total += Number(u?.progress?.[DOWNLOAD]?.bytes_total || 0);
	}
	return [done, total];
}

function readState(): State {
	const s = w.downloadsStore;
	const ov = localOverview(s);
	const appid = Number(ov?.update_appid || 0);
	let active: Active | null = null;
	if (appid) {
		const p = ov.progress?.[DOWNLOAD];
		const item = s?.GetDownloadItem?.(appid);
		const history = [...(s?.DownloadHistory || [])].filter((h: any) => h?.rt_sample_time > 0 && !h.is_upload).map((h: any) => Number(h.network_bytes_per_second || 0));
		active = {
			appid,
			install: ov.update_is_install ?? !item?.buildid,
			paused: !!ov.paused,
			pct: Math.max(0, Math.min(100, Math.round(Number(ov.overall_percent_complete || 0)))),
			done: Number(p?.bytes_in_progress || ov.update_bytes_downloaded || 0),
			total: Number(p?.bytes_total || ov.update_bytes_to_download || 0),
			speed: Number(ov.update_network_bytes_per_second || 0),
			seconds: Number(ov.overall_estimated_time_remaining_sec ?? ov.update_seconds_remaining ?? -1),
			started: Number(ov.update_start_time || 0),
			history: history.slice(-60),
		};
	}
	const items: Item[] = [];
	const add = (list: any, kind: Kind) => {
		for (const it of list || []) {
			const id = Number(it?.appid || 0);
			if (!id || id === appid || items.some((x) => x.appid === id)) continue;
			const [done, bytes] = itemBytes(it);
			items.push({ appid: id, kind, install: !it.buildid, bytes, done, when: kind === 'done' ? Number(it.completed_time || 0) : Number(it.deferred_time || 0) });
		}
	};
	add([...(s?.QueuedTransfers || [])].sort((a: any, b: any) => a.queue_index - b.queue_index), 'queued');
	add(s?.UnqueuedTransfers, 'paused');
	add(s?.ScheduledTransfers, 'scheduled');
	add([...(s?.CompletedTransfers || [])].sort((a: any, b: any) => (b.completed_time || 0) - (a.completed_time || 0)), 'done');
	return { active, items, allPaused: !!ov?.paused };
}

function useDownloads(): State {
	const [st, set] = useState<State>(readState);
	useEffect(() => {
		const id = setInterval(() => set(readState()), 1000);
		return () => clearInterval(id);
	}, []);
	return st;
}

// ---------- Formats ----------

/** Tailles comme Steam (base 1024) : « 1,1 Go ». */
function sizeLabel(bytes: number): string {
	if (bytes <= 0) return '';
	const go = bytes / 1024 ** 3;
	if (go >= 1) return `${go.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Go`;
	const mo = bytes / 1024 ** 2;
	return mo >= 1 ? `${Math.round(mo)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} ko`;
}

function remainingLabel(sec: number): string {
	if (sec < 0) return '';
	if (sec < 60) return 'moins d’une minute';
	const m = Math.round(sec / 60);
	if (m < 60) return `${m} min`;
	return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

function dayLabel(rt: number): string {
	const d = new Date(rt * 1000);
	const today = new Date();
	const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
	const time = `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
	if (days === 0) return `aujourd’hui à ${time}`;
	if (days === 1) return `demain à ${time}`;
	if (days === -1) return `hier à ${time}`;
	return `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à ${time}`;
}

/** « il y a 5 min », « il y a 3 h », puis la date. */
function agoLabel(rt: number): string {
	const s = Date.now() / 1000 - rt;
	if (s < 60) return 'à l’instant';
	if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
	if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
	return dayLabel(rt);
}

const kindLabel = (install: boolean) => (install ? 'Installation' : 'Mise à jour');

// ---------- Morceaux ----------

const svg = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const IconPause = () => (
	<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<rect x="6" y="5" width="4" height="14" rx="1" />
		<rect x="14" y="5" width="4" height="14" rx="1" />
	</svg>
);

const IconResume = () => (
	<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path d="M7 4.5v15l12-7.5z" />
	</svg>
);

const IconUp = () => (
	<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" {...svg}>
		<path d="M6 15l6-6 6 6" />
	</svg>
);

const IconDown = () => (
	<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" {...svg}>
		<path d="M6 9l6 6 6-6" />
	</svg>
);

/** Bannière horizontale du jeu (visuel personnalisé d'abord), nom du jeu si l'image manque. */
function Banner({ appid, width, radius }: { appid: number; width: number; radius: string }) {
	const app = appById(appid);
	const fallback = app ? landscapeUrl(app) : '';
	const src = useArt(app, 'header', fallback);
	const [broken, setBroken] = useState(false);
	useEffect(() => setBroken(false), [src]);
	const box = { width, maxWidth: '100%', aspectRatio: '460 / 215', borderRadius: radius, flex: 'none', overflow: 'hidden', background: 'var(--sp-surface2)' } as const;
	if (!src || broken)
		return (
			<span aria-hidden="true" style={{ ...box, display: 'flex', alignItems: 'flex-end', padding: 10, fontSize: 12, fontWeight: 800, color: 'var(--sp-muted)' }}>
				{app?.display_name || ''}
			</span>
		);
	return <img src={src} alt="" onError={() => setBroken(true)} style={{ ...box, display: 'block', objectFit: 'cover' }} />;
}

/** Débit des dernières secondes (relevés de Steam). */
function Sparkline({ values }: { values: number[] }) {
	if (values.length < 2) return null;
	const max = Math.max(...values, 1);
	const W = 180;
	const H = 40;
	const pts = values.map((v, i) => `${((i / (values.length - 1)) * W).toFixed(1)},${(H - 3 - (v / max) * (H - 6)).toFixed(1)}`).join(' ');
	return (
		<svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Débit des dernières secondes">
			<polyline points={pts} fill="none" stroke="var(--sp-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
		</svg>
	);
}

function name(appid: number): string {
	return appById(appid)?.display_name || `Jeu ${appid}`;
}

function ActiveCard({ a }: { a: Active }) {
	const n = name(a.appid);
	const facts: { strong: string; rest: string }[] = [];
	if (a.total > 0) facts.push({ strong: sizeLabel(a.done) || '0 Mo', rest: ` sur ${sizeLabel(a.total)}` });
	if (!a.paused && a.speed > 0) facts.push({ strong: speedLabel(a.speed), rest: '' });
	const left = remainingLabel(a.seconds);
	if (!a.paused && left) facts.push({ strong: left, rest: ' restantes' });
	return (
		<article className="sp-card" style={{ position: 'relative', overflow: 'hidden' }}>
			<div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, color-mix(in srgb, var(--sp-accent) 16%, transparent) 0%, transparent 60%)' }} />
			<div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 24, padding: '22px 24px' }}>
				<button type="button" onClick={() => navigate(ROUTES.app(a.appid))} aria-label={`Fiche du jeu : ${n}`} style={{ padding: 0, border: 0, background: 'transparent', display: 'block', borderRadius: 16 }}>
					<Banner appid={a.appid} width={276} radius="16px" />
				</button>
				<div style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
						<span style={{ fontSize: 20, fontWeight: 800 }}>{n}</span>
						<span className="sp-muted">
							{kindLabel(a.install)}
							{a.paused ? ' · en pause' : a.started ? ` · démarrée ${agoLabel(a.started)}` : ''}
						</span>
					</div>
					<span className="sp-bar" style={{ height: 8, borderRadius: 4 }} role="progressbar" aria-valuenow={a.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progression : ${a.pct} %`}>
						<i style={{ width: `${a.pct}%`, borderRadius: 4, boxShadow: 'var(--sp-glow)' }} />
					</span>
					<div className="sp-muted" style={{ display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: 13 }}>
						<span>
							<strong style={{ color: 'var(--sp-text)' }}>{a.pct} %</strong>
						</span>
						{facts.map((f) => (
							<span key={f.strong + f.rest}>
								<strong style={{ color: 'var(--sp-text)' }}>{f.strong}</strong>
								{f.rest}
							</span>
						))}
					</div>
				</div>
				<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
					<button
						type="button"
						className="sp-btn sp-btn--primary"
						style={{ height: 44, padding: '0 20px' }}
						onClick={() => (a.paused ? D().EnableAllDownloads(true, LOCAL_ID) : D().PauseAppUpdate(a.appid, LOCAL_ID))}
					>
						{a.paused ? <IconResume /> : <IconPause />}
						{a.paused ? 'Reprendre' : 'Pause'}
					</button>
					{!a.paused && <Sparkline values={a.history} />}
				</div>
			</div>
		</article>
	);
}

const iconBtn = { width: 36, height: 36, padding: 0, color: 'var(--sp-muted)' } as const;
const smallBtn = { height: 36, padding: '0 14px' } as const;

function Row({ it, first, last, noReorder }: { it: Item; first: boolean; last: boolean; noReorder: boolean }) {
	const n = name(it.appid);
	const done = it.kind === 'done';
	let line = kindLabel(it.install);
	if (it.kind === 'paused') line += ' · en pause';
	if (it.kind === 'scheduled') line = `${line} prévue ${it.when ? dayLabel(it.when) : ''}`.trim();
	if (done && it.when) line += ` · terminée ${agoLabel(it.when)}`;
	const left = it.bytes - it.done;
	if (!done && it.bytes > 0) line += ` · ${it.done > 0 ? `${sizeLabel(left)} restants sur ${sizeLabel(it.bytes)}` : sizeLabel(it.bytes)}`;
	return (
		<div role="listitem" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, minHeight: done ? 64 : 76, padding: done ? '8px 0' : '10px 0', borderTop: first ? 0 : '1px solid var(--sp-line)' }}>
			<button type="button" onClick={() => navigate(ROUTES.app(it.appid))} aria-label={`Fiche du jeu : ${n}`} style={{ padding: 0, border: 0, background: 'transparent', display: 'block' }}>
				<Banner appid={it.appid} width={done ? 88 : 112} radius={done ? '9px' : '10px'} />
			</button>
			<div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
				<span style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n}</span>
				<span className="sp-muted" style={{ fontSize: 12 }}>
					{line}
				</span>
			</div>
			<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
				{it.kind === 'queued' && !noReorder && (
					<>
						<button type="button" className="sp-btn" style={iconBtn} aria-label={`Monter dans la file : ${n}`} disabled={first} onClick={() => D().MoveAppUpdateUp(it.appid, LOCAL_ID)}>
							<IconUp />
						</button>
						<button type="button" className="sp-btn" style={iconBtn} aria-label={`Descendre dans la file : ${n}`} disabled={last} onClick={() => D().MoveAppUpdateDown(it.appid, LOCAL_ID)}>
							<IconDown />
						</button>
					</>
				)}
				{(it.kind === 'queued' || it.kind === 'paused') && (
					<button type="button" className="sp-btn" style={smallBtn} aria-label={`${it.kind === 'paused' ? 'Reprendre' : 'Démarrer'} : ${n}`} onClick={() => D().ResumeAppUpdate(it.appid, LOCAL_ID)}>
						{it.kind === 'paused' ? 'Reprendre' : 'Démarrer'}
					</button>
				)}
				{it.kind === 'scheduled' && (
					<button type="button" className="sp-btn" style={smallBtn} aria-label={`Mettre à jour maintenant : ${n}`} onClick={() => D().ResumeAppUpdate(it.appid, LOCAL_ID)}>
						Mettre à jour maintenant
					</button>
				)}
				{done && (
					<span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--sp-online)', fontWeight: 700, fontSize: 13, marginRight: 4 }}>
						<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" {...svg} strokeWidth={2.6}>
							<path d="M5 12l5 5 9-10" />
						</svg>
						Prêt
					</span>
				)}
				{it.kind !== 'scheduled' && (
					<button
						type="button"
						className="sp-btn"
						style={{ ...iconBtn, border: done ? 0 : undefined }}
						aria-label={`${done ? 'Effacer de la liste' : 'Retirer de la file'} : ${n}`}
						title={done ? 'Effacer de la liste' : 'Retirer de la file'}
						onClick={() => D().RemoveFromDownloadList(it.appid, LOCAL_ID)}
					>
						<IconClose />
					</button>
				)}
			</div>
		</div>
	);
}

function Section({ id, title, action, children }: { id: string; title: string; action?: any; children: any }) {
	return (
		<section aria-labelledby={id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 32 }}>
				<h2 id={id} className="sp-label" style={{ flex: 1, margin: 0 }}>
					{title}
				</h2>
				{action}
			</div>
			{children}
		</section>
	);
}

function List({ items }: { items: Item[] }) {
	const queued = items.filter((i) => i.kind === 'queued');
	return (
		<div role="list" className="sp-card" style={{ padding: '4px 18px', borderRadius: 'var(--sp-r-lg)' }}>
			{items.map((it, i) => {
				const qi = queued.indexOf(it);
				return <Row key={it.appid} it={it} first={i === 0} last={qi === queued.length - 1} noReorder={queued.length < 2} />;
			})}
		</div>
	);
}

export function DownloadsPage() {
	const pageRef = usePageTransition();
	const st = useDownloads();
	const waiting = st.items.filter((i) => i.kind === 'queued' || i.kind === 'paused');
	const scheduled = st.items.filter((i) => i.kind === 'scheduled');
	const done = st.items.filter((i) => i.kind === 'done');
	const summary = [st.active ? '1 en cours' : '', waiting.length ? `${waiting.length} en attente` : '', scheduled.length ? plural(scheduled.length, 'planifié', 'planifiés') : '']
		.filter(Boolean)
		.join(' · ');
	const busy = !!st.active || waiting.some((i) => i.kind === 'queued');
	const clearAll = () => done.forEach((i) => D().RemoveFromDownloadList(i.appid, LOCAL_ID));
	return (
		<div className="sp-root" ref={pageRef}>
			<main style={{ width: '100%', maxWidth: 1180, margin: '0 auto', padding: '32px 40px 64px', display: 'flex', flexDirection: 'column', gap: 28 }}>
				<div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
					<div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 4 }}>
						<h1 className="sp-h1">Téléchargements</h1>
						<span className="sp-muted">{summary || 'Aucun téléchargement en cours'}</span>
					</div>
					{(busy || st.allPaused) && (
						<button type="button" className="sp-btn" onClick={() => D().EnableAllDownloads(st.allPaused, LOCAL_ID)}>
							{st.allPaused ? <IconResume /> : <IconPause />}
							{st.allPaused ? 'Tout reprendre' : 'Tout mettre en pause'}
						</button>
					)}
					<button type="button" className="sp-btn sp-btn--icon" aria-label="Paramètres des téléchargements" title="Paramètres des téléchargements" onClick={() => openSteamSettings('Downloads')} style={{ color: 'var(--sp-muted)' }}>
						<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" {...svg} strokeWidth={2}>
							<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
							<circle cx="12" cy="12" r="3" />
						</svg>
					</button>
				</div>

				{st.active && (
					<Section id="spd-active" title="En cours">
						<ActiveCard a={st.active} />
					</Section>
				)}

				{waiting.length > 0 && (
					<Section id="spd-queue" title={`En attente · ${waiting.length}`}>
						<List items={waiting} />
					</Section>
				)}

				{scheduled.length > 0 && (
					<Section id="spd-scheduled" title={`Planifiés · ${scheduled.length}`}>
						<List items={scheduled} />
					</Section>
				)}

				{done.length > 0 && (
					<Section
						id="spd-done"
						title="Terminés"
						action={
							<button type="button" className="sp-btn" style={{ height: 32, padding: '0 12px', border: 0, color: 'var(--sp-muted)' }} onClick={clearAll}>
								Tout effacer
							</button>
						}
					>
						<List items={done} />
					</Section>
				)}

				{!st.active && !st.items.length && (
					<div className="sp-card" style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
						<span style={{ fontWeight: 700 }}>La file est vide</span>
						<span className="sp-muted">Les installations et mises à jour apparaîtront ici.</span>
					</div>
				)}
			</main>
		</div>
	);
}
