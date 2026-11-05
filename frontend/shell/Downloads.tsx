// Bouton « Téléchargements » de la barre du haut : ouvre la page des téléchargements et montre la progression.
import { useEffect, useState } from 'react';
import { appById, navigate, ROUTES } from '../core/steam';
import { usePath } from '../core/history';

const w = window as any;

export type DlState = { active: boolean; paused: boolean; pct: number; name: string; queued: number; speed: number };

/** État du téléchargement en cours (aussi utilisé par Big Picture). */
export function readState(): DlState {
	const store = w.downloadsStore;
	const ov = store?.DownloadOverview;
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
	};
}

export function speedLabel(bps: number): string {
	if (bps <= 0) return '';
	const mo = bps / 1e6;
	return mo >= 1 ? `${mo.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo/s` : `${Math.round(bps / 1e3)} ko/s`;
}

export function DownloadsButton() {
	const [st, setSt] = useState<DlState>(readState);
	const path = usePath();

	useEffect(() => {
		const id = setInterval(() => setSt(readState()), 1000);
		return () => clearInterval(id);
	}, []);

	const current = path === ROUTES.downloads || path.startsWith('/library/downloads');
	const title = st.active
		? `${st.name || 'Téléchargement'} : ${st.paused ? 'en pause' : `${st.pct} %${st.speed ? ` · ${speedLabel(st.speed)}` : ''}`}${st.queued > 1 ? ` · ${st.queued - 1} en attente` : ''}`
		: 'Téléchargements';

	return (
		<button
			type="button"
			className={st.active ? 'sp-dl sp-dl-active' : 'sp-dl'}
			aria-current={current ? 'page' : undefined}
			aria-label={title}
			title={title}
			onClick={() => navigate(ROUTES.downloads)}
		>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
				<path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
			</svg>
			{st.active && (
				<span className="sp-dl-bar" aria-hidden="true">
					<i style={{ width: `${st.pct}%` }} />
				</span>
			)}
		</button>
	);
}
