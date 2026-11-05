// Paramètres › Mises à jour : version installée et mises à jour (updates.tsx), désinstallation de Steam Upgraded depuis Steam.
// Ordre : fichier .star supprimé par notre backend, réglages effacés (sauf choix contraire), plugin désactivé
// dans Millennium (son backend s'arrête), puis interface rechargée sans nous. Millennium reste installé.
import { useState } from 'react';
import { UpdateSections } from './updates';

const w = window as any;
export const PLUGIN_ID = 'com.venacity.steamupgraded';
const START_KEY = 'steamupgraded:contextStartUrl';

const core = (method: string, args?: any) => w.Millennium.callServerMethod('core', method, args);
const parse = (raw: any) => (typeof raw === 'string' ? JSON.parse(raw) : raw);

/** Notre plugin tel que Millennium le voit (version, chemin du .star). */
export async function selfInfo(): Promise<{ version: string; path: string } | null> {
	try {
		const list = parse(await core('Core_FindAllPlugins'));
		const me = (Array.isArray(list) ? list : []).find((p: any) => p?.data?.name === PLUGIN_ID);
		return me ? { version: String(me.data.version || ''), path: String(me.path || '') } : null;
	} catch {
		return null;
	}
}

export async function uninstallPlugin(keepSettings: boolean): Promise<void> {
	const me = await selfInfo();
	if (!me?.path) throw new Error('Millennium ne trouve pas le plugin.');
	// Le fichier d'abord : s'il ne part pas, le plugin reste en place avec tous ses réglages
	const removed = parse(await backend.sp_remove_plugin_file(me.path));
	if (!removed?.ok) throw new Error(removed?.error || 'Le fichier du plugin n’a pas pu être supprimé.');
	if (!keepSettings) {
		try {
			const r = parse(await core('PluginConfig_DeleteAll', { plugin_name: PLUGIN_ID }));
			if (r && r.success === false) console.error('[steam-upgraded] réglages non effacés à la désinstallation');
		} catch (e) {
			console.error('[steam-upgraded] réglages non effacés à la désinstallation', e);
		}
	}
	await core('Core_ChangePluginStatus', { pluginJson: JSON.stringify([{ plugin_name: PLUGIN_ID, enabled: false }]) });
	restartInterface();
}

/** Recharge l'interface sur son adresse de démarrage (voir core/history.ts : une adresse /routes/… ne se recharge pas). */
export function restartInterface() {
	try {
		if (w.location?.pathname?.startsWith('/routes/')) w.history.replaceState(w.history.state, '', w.localStorage?.getItem(START_KEY) || '/index.html');
	} catch {}
	setTimeout(() => w.SteamClient.Browser.RestartJSContext(), 400);
}

function Confirm({ onClose }: { onClose: () => void }) {
	const [keep, setKeep] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const run = async () => {
		setBusy(true);
		setError('');
		try {
			await uninstallPlugin(keep);
		} catch (e: any) {
			setError(e?.message || String(e));
			setBusy(false);
		}
	};
	return (
		<div className="sp-scrim" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()} onKeyDown={(e) => e.key === 'Escape' && !busy && onClose()}>
			<style>{'.sp-uninst .sp-btn{align-items:center;}.sp-uninst button:disabled{cursor:default;opacity:.5;}'}</style>
			<section role="dialog" aria-modal="true" aria-labelledby="sp-uninst-title" className="sp-card sp-uninst" style={{ position: 'relative', width: 540, maxWidth: '100%', padding: 28, borderRadius: 26, background: 'var(--sp-surface)', boxShadow: '0 30px 80px rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column', gap: 14 }}>
				<h2 id="sp-uninst-title" className="sp-h2" style={{ fontSize: 21 }}>Désinstaller Steam Upgraded ?</h2>
				<p className="sp-muted" style={{ margin: 0, lineHeight: 1.55 }}>Le plugin est désactivé et retiré, puis l'interface de Steam se recharge telle qu'à l'origine.</p>
				<button type="button" role="checkbox" aria-checked={keep} disabled={busy} onClick={() => setKeep(!keep)} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 0, border: 0, background: 'transparent', textAlign: 'left' }}>
					<span aria-hidden="true" style={{ flex: 'none', width: 22, height: 22, marginTop: 1, borderRadius: 7, boxSizing: 'border-box', border: keep ? 0 : '1.5px solid var(--sp-muted)', background: keep ? 'var(--sp-accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
						{keep && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'var(--sp-accent-ink)' }}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
					</span>
					<span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
						<span style={{ fontWeight: 700 }}>Garder les réglages</span>
						<span className="sp-muted" style={{ fontSize: 12.5 }}>Thème, présence, clé SteamGridDB et relevés de temps de jeu, retrouvés en cas de réinstallation. Sinon, ils sont effacés.</span>
					</span>
				</button>
				<p className="sp-muted" style={{ margin: 0, fontSize: 12.5 }}>Millennium reste installé. Pour le retirer aussi, utilisez l'installeur.</p>
				{error && <div role="alert" style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--sp-surface2)', fontSize: 13 }}>{error}</div>}
				<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 6 }}>
					<button type="button" className="sp-btn" disabled={busy} onClick={onClose}>Annuler</button>
					<button type="button" className="sp-btn" disabled={busy} onClick={run} style={{ border: 0, background: 'var(--sp-busy)', color: 'var(--sp-accent-ink)', fontWeight: 800 }}>
						{busy ? 'Désinstallation…' : 'Désinstaller'}
					</button>
				</div>
			</section>
		</div>
	);
}

/** Contenu de Paramètres › Mises à jour. */
export function UpdatesPanel({ Section }: { Section: (p: { id: string; title: string; sub?: string; children: any }) => any }) {
	const [confirm, setConfirm] = useState(false);
	return (
		<>
			<UpdateSections Section={Section} />
			<Section id="h-uninstall" title="Désinstaller Steam Upgraded" sub="Rend à Steam son interface d'origine. Vos jeux, votre compte et les visuels déjà appliqués restent.">
				<div>
					<button type="button" className="sp-btn" onClick={() => setConfirm(true)} style={{ border: '1px solid var(--sp-busy)', background: 'transparent', color: 'var(--sp-busy)', fontWeight: 700 }}>
						Désinstaller…
					</button>
				</div>
			</Section>
			{confirm && <Confirm onClose={() => setConfirm(false)} />}
		</>
	);
}
