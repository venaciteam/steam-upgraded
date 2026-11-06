// Big Picture › Téléchargements (remplace /library/downloads) : le jeu en cours en grande bannière (pause,
// fiche du jeu), puis la file en rangée de capsules (à suivre, programmés, en pause, terminés).
// A sur une capsule ouvre un menu d'options : rien ne démarre sur un appui réflexe.
import { useEffect, useState } from 'react';
import { DialogButton, Focusable, Menu, MenuItem, MenuSeparator } from 'millennium';
import { appById, landscapeUrl } from '../core/steam';
import { LOCAL_ID } from '../core/machines';
import { speedLabel } from '../shell/Downloads';
import { plural } from '../pages/library/data';
import { BpFrame, goBackBp, useClock } from './Frame';
import { HeroImage, Landscape, openGame, showBpMenu } from './gameActions';

const w = window as any;
/** Index de l'étape « téléchargement » dans les progressions de Steam (k_EAppUpdateProgress_Download). */
const DOWNLOAD = 2;

type Kind = 'next' | 'scheduled' | 'paused' | 'done';

type Item = { appid: number; kind: Kind; bytes: number; done: number; when: number; index: number };

type Active = { appid: number; paused: boolean; pct: number; done: number; total: number; speed: number; seconds: number };

type State = { active: Active | null; items: Item[]; autoUpdates: string };

function store(): any {
	return w.downloadsStore;
}

/** Octets à télécharger et déjà téléchargés d'un élément de la liste (même calcul que Steam). */
function itemBytes(it: any): [number, number] {
	let done = 0;
	let total = 0;
	for (const u of it?.update_type_info || []) {
		done += Number(u?.progress?.[DOWNLOAD]?.bytes_in_progress || 0);
		total += Number(u?.progress?.[DOWNLOAD]?.bytes_total || 0);
	}
	return [done, total];
}

function readActive(): Active | null {
	const ov = store()?.DownloadOverview;
	const appid = Number(ov?.update_appid || 0);
	if (!appid) return null;
	const p = ov?.progress?.[DOWNLOAD];
	return {
		appid,
		paused: !!ov.paused,
		pct: Math.max(0, Math.min(100, Math.round(Number(ov.overall_percent_complete || 0)))),
		done: Number(p?.bytes_in_progress || ov.update_bytes_downloaded || 0),
		total: Number(p?.bytes_total || ov.update_bytes_to_download || 0),
		speed: Number(ov.update_network_bytes_per_second || 0),
		seconds: Number(ov.overall_estimated_time_remaining_sec || -1),
	};
}

function readState(): State {
	const s = store();
	const active = readActive();
	const items: Item[] = [];
	const add = (list: any[] | undefined, kind: Kind) => {
		for (const it of list || []) {
			const appid = Number(it?.appid || 0);
			if (!appid || appid === active?.appid || items.some((x) => x.appid === appid)) continue;
			const [done, bytes] = itemBytes(it);
			items.push({ appid, kind, bytes, done, when: kind === 'done' ? Number(it.completed_time || 0) : Number(it.deferred_time || 0), index: Number(it.queue_index ?? -1) });
		}
	};
	add([...(s?.QueuedTransfers || [])].sort((a: any, b: any) => a.queue_index - b.queue_index), 'next');
	add(s?.ScheduledTransfers, 'scheduled');
	add(s?.UnqueuedTransfers, 'paused');
	add(s?.CompletedTransfers, 'done');
	const restrict = !!s?.CurrentViewingRestrictAutoUpdates;
	const autoUpdates = restrict
		? `Mises à jour automatiques de ${s.CurrentViewingRestrictAutoUpdatesStart} h à ${s.CurrentViewingRestrictAutoUpdatesEnd} h`
		: 'Mises à jour automatiques activées';
	return { active, items, autoUpdates };
}

function useDownloads(): State {
	const [st, set] = useState<State>(readState);
	useEffect(() => {
		const id = setInterval(() => set(readState()), 1000);
		return () => clearInterval(id);
	}, []);
	return st;
}

/** Tailles comme Steam (base 1024) : « 1,1 Go ». */
export function sizeLabel(bytes: number): string {
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
	if (m < 60) return `${m} min restantes`;
	const h = Math.floor(m / 60);
	return `${h} h ${String(m % 60).padStart(2, '0')} restantes`;
}

function dayLabel(rt: number): string {
	const d = new Date(rt * 1000);
	const today = new Date();
	const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
	const time = d.toLocaleTimeString('fr-FR', { hour: 'numeric', minute: '2-digit' });
	if (days === 0) return `aujourd’hui à ${time}`;
	if (days === 1) return `demain à ${time}`;
	if (days === -1) return `hier à ${time}`;
	return `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à ${time}`;
}

const KIND: Record<Kind, { label: string; color: string }> = {
	next: { label: 'À suivre', color: 'var(--sp-accent)' },
	scheduled: { label: 'Programmé', color: 'var(--sp-away)' },
	paused: { label: 'En pause', color: 'var(--sp-muted)' },
	done: { label: 'Terminé', color: 'var(--sp-online)' },
};

function stateLine(it: Item): string {
	const parts = [KIND[it.kind].label];
	if (it.kind === 'scheduled' && it.when) parts.push(dayLabel(it.when));
	if (it.kind === 'done' && it.when) parts.push(dayLabel(it.when));
	if (it.kind !== 'done' && it.bytes) parts.push(sizeLabel(it.bytes));
	return parts.join(' · ');
}

const D = () => w.SteamClient.Downloads;

function itemMenu(it: Item, name: string) {
	showBpMenu(
		<Menu label={name}>
			{/* « Fiche du jeu » d'abord : c'est là qu'arrive le focus, un appui réflexe ne lance rien */}
			<MenuItem onSelected={() => openGame(it.appid)}>Fiche du jeu</MenuItem>
			{it.kind !== 'done' && <MenuItem onSelected={() => D().ResumeAppUpdate(it.appid, LOCAL_ID)}>{it.kind === 'next' ? 'Passer en premier' : 'Télécharger maintenant'}</MenuItem>}
			<MenuSeparator />
			<MenuItem onSelected={() => D().RemoveFromDownloadList(it.appid, LOCAL_ID)}>Retirer de la liste</MenuItem>
		</Menu>,
	);
}

function Capsule({ it, first }: { it: Item; first: boolean }) {
	const app = appById(it.appid);
	const name = app?.display_name || `Jeu ${it.appid}`;
	return (
		<DialogButton
			className={`spbp-capsule spbp-capsule--dl${it.kind === 'done' ? ' spbp-capsule--done' : ''}`}
			noFocusRing
			autoFocus={first}
			onClick={() => itemMenu(it, name)}
			onOKActionDescription="Options"
			onOptionsButton={it.kind === 'next' ? () => D().ResumeAppUpdate(it.appid, LOCAL_ID) : undefined}
			onOptionsActionDescription={it.kind === 'next' ? 'Passer en premier' : undefined}
			aria-label={`${name}, ${stateLine(it)}`}
		>
			{app ? <Landscape app={app} fallback={landscapeUrl(app)} className="spbp-capsule-img" /> : <span className="spbp-capsule-img" />}
			<span className="spbp-capsule-name">{name}</span>
			<span className="spbp-capsule-sub" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
				<span className="spbp-dot" style={{ width: 10, height: 10, background: KIND[it.kind].color }} />
				{stateLine(it)}
			</span>
		</DialogButton>
	);
}

function ActiveHero({ a, autoUpdates, clock }: { a: Active; autoUpdates: string; clock: string }) {
	const app = appById(a.appid);
	const name = app?.display_name || `Jeu ${a.appid}`;
	const facts = [a.paused ? '' : speedLabel(a.speed), a.paused ? '' : remainingLabel(a.seconds)].filter(Boolean);
	return (
		<section aria-label="Téléchargement en cours" className="spbp-dl-hero">
			{app && <HeroImage app={app} />}
			<div aria-hidden="true" className="spbp-dl-fade" />
			<DlTop autoUpdates={autoUpdates} clock={clock} />
			<div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1180 }}>
				<span className="spbp-kicker">{a.paused ? 'En pause' : 'En cours'}</span>
				<span style={{ fontSize: 84, fontWeight: 800, lineHeight: 0.95, color: '#fff', textShadow: '0 2px 18px rgba(0,0,0,.5)' }}>{name}</span>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<span style={{ display: 'flex', alignItems: 'baseline', gap: 18, color: '#fff' }}>
						<b style={{ fontSize: 44, fontWeight: 800 }}>{a.pct} %</b>
						{a.total > 0 && (
							<span style={{ fontSize: 22, color: 'rgba(255,255,255,.8)' }}>
								{sizeLabel(a.done) || '0 Mo'} sur {sizeLabel(a.total)}
							</span>
						)}
					</span>
					<span className="spbp-bar" style={{ height: 14, background: 'rgba(255,255,255,.18)' }}>
						<i style={{ width: `${a.pct}%` }} />
					</span>
				</div>
				<Focusable flow-children="row" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
					<DialogButton className="spbp-btn spbp-btn--primary" noFocusRing autoFocus onClick={() => D().EnableAllDownloads(a.paused, LOCAL_ID)} onOKActionDescription={a.paused ? 'Reprendre' : 'Mettre en pause'} style={{ height: 76, fontSize: 26 }}>
						<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d={a.paused ? 'M7 4.5v15l12-7.5z' : 'M6 4h4v16H6zM14 4h4v16h-4z'} />
						</svg>
						{a.paused ? 'Reprendre' : 'Mettre en pause'}
					</DialogButton>
					<DialogButton className="spbp-btn spbp-btn--glass" noFocusRing onClick={() => openGame(a.appid)} onOKActionDescription="Ouvrir" style={{ height: 76 }}>
						Fiche du jeu
					</DialogButton>
					{facts.length > 0 && (
						<span style={{ marginLeft: 18, display: 'flex', gap: 12 }}>
							{facts.map((f) => (
								<span key={f} className="spbp-tag">
									{f}
								</span>
							))}
						</span>
					)}
				</Focusable>
			</div>
		</section>
	);
}

function DlTop({ autoUpdates, clock }: { autoUpdates: string; clock: string }) {
	return (
		<div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 24 }}>
			<h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: '#fff' }}>Téléchargements</h1>
			<span className="spbp-tag">{autoUpdates}</span>
			<span style={{ flex: 1 }} />
			<span style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#fff' }}>{clock}</span>
		</div>
	);
}

function IdleHero({ autoUpdates, clock, next }: { autoUpdates: string; clock: string; next?: Item }) {
	const app = next ? appById(next.appid) : null;
	return (
		<section aria-label="Aucun téléchargement en cours" className="spbp-dl-hero spbp-dl-hero--idle">
			{app && <HeroImage app={app} style={{ opacity: 0.35 }} />}
			<div aria-hidden="true" className="spbp-dl-fade" />
			<DlTop autoUpdates={autoUpdates} clock={clock} />
			<div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
				<span style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, color: '#fff' }}>Aucun téléchargement en cours</span>
				{next && app && (
					<span style={{ fontSize: 24, color: 'rgba(255,255,255,.85)' }}>
						Prochain : {app.display_name}
						{next.kind === 'scheduled' && next.when ? `, ${dayLabel(next.when)}` : ''}
					</span>
				)}
			</div>
		</section>
	);
}

export function BpDownloads() {
	const st = useDownloads();
	const clock = useClock();
	const waiting = st.items.filter((i) => i.kind !== 'done');
	const total = waiting.reduce((n, i) => n + Math.max(0, i.bytes - i.done), 0) + (st.active ? Math.max(0, st.active.total - st.active.done) : 0);
	const next = st.items.find((i) => i.kind === 'next') || st.items.find((i) => i.kind === 'scheduled');
	const info = waiting.length || st.active ? `${plural(waiting.length, 'jeu', 'jeux')} en file${total ? ` · ${sizeLabel(total)} restants` : ''}` : 'File vide';
	return (
		<BpFrame header={false} onBack={goBackBp} info={<span>{info}</span>}>
			{st.active ? <ActiveHero a={st.active} autoUpdates={st.autoUpdates} clock={clock} /> : <IdleHero autoUpdates={st.autoUpdates} clock={clock} next={next} />}
			<section aria-labelledby="spbp-dl-queue" style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 34 }}>
				<h2 id="spbp-dl-queue" className="spbp-h2" style={{ paddingLeft: 72 }}>
					File d’attente
				</h2>
				{st.items.length ? (
					<Focusable flow-children="row" style={{ display: 'flex', gap: 28, padding: '24px 72px 24px', margin: '-16px 0 0', overflowX: 'auto', scrollbarWidth: 'none' } as any}>
						{st.items.map((it, i) => (
							<Capsule key={it.appid} it={it} first={!st.active && i === 0} />
						))}
					</Focusable>
				) : (
					<Focusable style={{ padding: '0 72px' }}>
						<DialogButton className="spbp-empty" noFocusRing autoFocus={!st.active} onOKActionDescription="">
							Aucun autre téléchargement dans la file
						</DialogButton>
					</Focusable>
				)}
			</section>
		</BpFrame>
	);
}
