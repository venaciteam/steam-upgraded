// Bouton « Téléchargements » de la barre du haut : ouvre la page des téléchargements et montre la progression.
// Libellé affiché quand la barre a la place (theme.ts le masque en fenêtre étroite) ; au survol, une bulle détaille
// le téléchargement en cours. Pas d'attribut `title` : l'infobulle native se réaffichait (clignotait) à chaque
// changement du pourcentage.
import { useEffect, useRef, useState } from 'react';
import { appById, navigate, ROUTES } from '../core/steam';
import { usePath } from '../core/history';

const w = window as any;

export type DlState = { active: boolean; paused: boolean; pct: number; name: string; queued: number; speed: number; seconds: number; install: boolean };

/**
 * État du téléchargement de cet ordinateur. Steam range désormais l'état par machine du compte : `DownloadOverview` est
 * devenu une fonction (identifiant de machine), la machine locale a son accesseur `LocalDownloadOverview`.
 */
export function localOverview(store: any = w.downloadsStore): any {
	if (!store) return null;
	if ('LocalDownloadOverview' in store) return store.LocalDownloadOverview;
	const ov = store.DownloadOverview;
	return typeof ov === 'function' ? ov.call(store, '0') : ov;
}

/** État du téléchargement en cours (aussi utilisé par Big Picture). */
export function readState(): DlState {
	const store = w.downloadsStore;
	const ov = localOverview(store);
	const appid = Number(ov?.update_appid || 0);
	const total = Number(ov?.update_bytes_to_download || 0);
	const done = Number(ov?.update_bytes_downloaded || 0);
	const queued = (store?.QueuedTransfers?.length || 0) as number;
	// Progression globale de Steam (comme la page Téléchargements), sinon la part téléchargée
	const overall = Number(ov?.overall_percent_complete);
	return {
		active: appid > 0,
		paused: !!ov?.paused,
		pct: Number.isFinite(overall) && overall > 0 ? Math.min(100, Math.round(overall)) : total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0,
		name: appid ? appById(appid)?.display_name || '' : '',
		queued,
		speed: Number(ov?.update_network_bytes_per_second || 0),
		seconds: Number(ov?.overall_estimated_time_remaining_sec ?? ov?.update_seconds_remaining ?? -1),
		install: !!(ov?.update_is_install ?? (appid && !store?.GetDownloadItem?.(appid)?.buildid)),
	};
}

export function speedLabel(bps: number): string {
	if (bps <= 0) return '';
	const mo = bps / 1e6;
	return mo >= 1 ? `${mo.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo/s` : `${Math.round(bps / 1e3)} ko/s`;
}

/** Temps restant (« 12 min », « 1 h 05 », « moins d’une minute ») ; vide si Steam ne le donne pas. */
export function remainingLabel(sec: number): string {
	if (!Number.isFinite(sec) || sec < 0) return '';
	if (sec < 60) return 'moins d’une minute';
	const m = Math.round(sec / 60);
	if (m < 60) return `${m} min`;
	return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

/** Libellé court du bouton. */
function buttonLabel(st: DlState): string {
	if (!st.active) return 'Téléchargements';
	return `${st.paused ? 'En pause' : 'Téléchargement'} · ${st.pct} %`;
}

const SHOW_DELAY = 250;

export function DownloadsButton() {
	const [st, setSt] = useState<DlState>(readState);
	const [tip, setTip] = useState<{ top: number; right: number } | null>(null);
	const btn = useRef<HTMLButtonElement>(null);
	const timer = useRef<any>(0);
	const path = usePath();

	useEffect(() => {
		const id = setInterval(() => setSt(readState()), 1000);
		return () => {
			clearInterval(id);
			clearTimeout(timer.current);
		};
	}, []);

	const show = () => {
		clearTimeout(timer.current);
		timer.current = setTimeout(() => {
			const el = btn.current;
			if (!el) return;
			const r = el.getBoundingClientRect();
			const W = el.ownerDocument.defaultView?.innerWidth || 0;
			setTip({ top: r.bottom + 8, right: Math.max(8, W - r.right) });
		}, SHOW_DELAY);
	};
	const hide = () => {
		clearTimeout(timer.current);
		setTip(null);
	};

	const current = path === ROUTES.downloads || path.startsWith('/library/downloads');
	const left = st.active && !st.paused ? remainingLabel(st.seconds) : '';
	const facts = st.active ? [st.paused ? 'En pause' : speedLabel(st.speed), left && `Reste ${left}`].filter(Boolean) : [];
	const waiting = st.queued > (st.active ? 1 : 0) ? `${st.queued - (st.active ? 1 : 0)} en attente` : '';

	return (
		<>
			<button
				ref={btn}
				type="button"
				className={st.active ? `sp-dl sp-dl-active${st.paused ? '' : ' sp-dl-moving'}` : 'sp-dl'}
				aria-current={current ? 'page' : undefined}
				aria-label="Téléchargements"
				aria-describedby={tip ? 'sp-dl-tip' : undefined}
				onClick={() => {
					hide();
					navigate(ROUTES.downloads);
				}}
				onMouseEnter={show}
				onMouseLeave={hide}
				onFocus={show}
				onBlur={hide}
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
					<path className="sp-dl-arrow" d="M12 4v11M7 10l5 5 5-5" />
					<path d="M5 20h14" />
				</svg>
				<span className="sp-dl-text" aria-hidden="true">{buttonLabel(st)}</span>
				{st.active && (
					<span className="sp-dl-bar" aria-hidden="true">
						<i style={{ width: `${st.pct}%` }} />
					</span>
				)}
			</button>
			{tip && (
				<div id="sp-dl-tip" role="tooltip" className={st.active ? 'sp-pop sp-dl-tip' : 'sp-pop sp-dl-tip sp-dl-tip--idle'} style={{ top: tip.top, right: tip.right }}>
					{st.active ? (
						<>
							<div className="sp-label">{st.paused ? 'En pause' : st.install ? 'Installation en cours' : 'Mise à jour en cours'}</div>
							<div className="sp-dl-tip-name">{st.name || 'Jeu sans nom'}</div>
							<div className="sp-dl-tip-row">
								<span className="sp-dl-tip-bar">
									<i style={{ width: `${st.pct}%` }} />
								</span>
								<strong>{st.pct} %</strong>
							</div>
							{facts.length > 0 && <div className="sp-muted sp-dl-tip-facts">{facts.join(' · ')}</div>}
						</>
					) : (
						<div className="sp-dl-tip-name sp-dl-tip-idle">Aucun téléchargement en cours</div>
					)}
					{waiting && <div className="sp-muted sp-dl-tip-facts">{waiting}</div>}
				</div>
			)}
		</>
	);
}
