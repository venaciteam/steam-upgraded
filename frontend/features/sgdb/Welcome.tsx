// Fenêtre d'accueil SteamGridDB, rouverte depuis Paramètres › SteamGridDB :
// étape 1 explication et lien vers le site, étape 2 clé collée puis vérifiée, puis réussite. Même enregistrement que la section.
import { useEffect, useRef, useState } from 'react';
import { setSetting } from '../../core/settings';

const w = window as any;
const API_PAGE = 'https://www.steamgriddb.com/profile/preferences/api';

type Status = null | 'verif' | 'refusee' | 'injoignable';

async function check(key: string): Promise<'ok' | 'refusee' | 'injoignable'> {
	try {
		const raw = await backend.sgdb_check(key);
		const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
		if (data?.ok) return 'ok';
		return data?.status === 401 || data?.status === 403 ? 'refusee' : 'injoignable';
	} catch {
		return 'injoignable';
	}
}

const IconX = () => (
	<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
);
const IconExt = () => (
	<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);
const Pager = ({ step }: { step: 1 | 2 }) => (
	<span aria-label={`Étape ${step} sur 2`} style={{ display: 'flex', gap: 6 }}>
		{[1, 2].map((i) => (
			<span key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 4, background: i === step ? 'var(--sp-accent)' : 'var(--sp-line)' }} />
		))}
	</span>
);

export function SgdbWelcome({ onClose }: { onClose: () => void }) {
	const [step, setStep] = useState<1 | 2 | 3>(1);
	const [key, setKey] = useState('');
	const [status, setStatus] = useState<Status>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (step === 2) inputRef.current?.focus();
	}, [step]);

	const verify = async (force = false) => {
		const k = key.trim();
		if (!k) return;
		if (!force) {
			setStatus('verif');
			const r = await check(k);
			if (r !== 'ok') return setStatus(r);
		}
		await setSetting('sgdbKey', k);
		setStatus(null);
		setStep(3);
	};

	const later = (
		<button type="button" className="sp-btn" style={{ border: 0, background: 'transparent', color: 'var(--sp-muted)' }} onClick={onClose}>
			Plus tard
		</button>
	);

	return (
		<div className="sp-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
			<style>{'.sp-sgdbw .sp-btn{align-items:center;}.sp-sgdbw button:disabled{cursor:default;opacity:.4;}'}</style>
			<section role="dialog" aria-modal="true" aria-labelledby="sp-sgdbw-title" className="sp-card sp-sgdbw" style={{ position: 'relative', width: 520, maxWidth: '100%', padding: '26px 28px 22px', borderRadius: 26, background: 'var(--sp-surface)', boxShadow: '0 30px 80px rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column', gap: 14 }}>
				{step !== 3 && (
					<button type="button" aria-label="Plus tard" onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, padding: 0, border: 0, borderRadius: '50%', background: 'var(--sp-surface2)', color: 'var(--sp-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', ['cornerShape' as any]: 'round' }}>
						<IconX />
					</button>
				)}

				{step === 1 && (
					<>
						<span className="sp-label">SteamGridDB</span>
						<h2 id="sp-sgdbw-title" className="sp-h2" style={{ fontSize: 21, paddingRight: 40 }}>Des visuels à votre goût</h2>
						<p className="sp-muted" style={{ margin: 0, lineHeight: 1.55 }}>Jaquettes, bannières et logos peuvent venir de SteamGridDB, un site communautaire gratuit. Il faut pour cela une clé personnelle, gratuite elle aussi.</p>
						<ol style={{ margin: 0, padding: '14px 16px 14px 34px', borderRadius: 16, background: 'var(--sp-surface2)', display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.45 }}>
							<li>Ouvrez SteamGridDB et connectez-vous avec Steam.</li>
							<li>Dans la section API, cliquez sur « Generate API Key ».</li>
							<li>Copiez la clé, puis revenez ici et cliquez sur Suivant.</li>
						</ol>
						<div>
							<button type="button" className="sp-btn" style={{ display: 'inline-flex', gap: 8 }} onClick={() => w.SteamClient.System.OpenInSystemBrowser(API_PAGE)}>
								Ouvrir SteamGridDB <IconExt />
							</button>
						</div>
						<div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 6 }}>
							<Pager step={1} />
							<span style={{ flex: 1 }} />
							{later}
							<button type="button" className="sp-btn sp-btn--primary" onClick={() => setStep(2)}>Suivant</button>
						</div>
					</>
				)}

				{step === 2 && (
					<>
						<span className="sp-label">Clé SteamGridDB</span>
						<h2 id="sp-sgdbw-title" className="sp-h2" style={{ fontSize: 21, paddingRight: 40 }}>Collez votre clé</h2>
						<p className="sp-muted" style={{ margin: 0, lineHeight: 1.55 }}>Elle est vérifiée auprès de SteamGridDB puis enregistrée sur cet ordinateur, comme dans Paramètres › SteamGridDB.</p>
						<label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
							<span style={{ fontSize: 12, fontWeight: 700, color: 'var(--sp-muted)' }}>Clé API</span>
							<input
								ref={inputRef}
								className="sp-input"
								type="text"
								spellCheck={false}
								placeholder="Collez la clé ici"
								value={key}
								onChange={(e) => {
									setKey((e.target as HTMLInputElement).value);
									setStatus(null);
								}}
								onKeyDown={(e) => e.key === 'Enter' && status !== 'verif' && verify()}
								style={{ fontFamily: 'Consolas, monospace', borderColor: status === 'refusee' ? 'var(--sp-busy)' : undefined }}
							/>
						</label>
						{status === 'refusee' && (
							<div role="alert" style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--sp-surface2)', fontSize: 13, lineHeight: 1.45 }}>
								SteamGridDB refuse cette clé. Vérifiez qu'elle a été copiée en entier, sans espace.
							</div>
						)}
						{status === 'injoignable' && (
							<div role="alert" style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--sp-surface2)', fontSize: 13, lineHeight: 1.45 }}>
								SteamGridDB ne répond pas. Réessayez plus tard, ou enregistrez la clé telle quelle.
							</div>
						)}
						<div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 6 }}>
							<Pager step={2} />
							<span style={{ flex: 1 }} />
							{later}
							<button type="button" className="sp-btn" onClick={() => setStep(1)}>Retour</button>
							{status === 'injoignable' ? (
								<button type="button" className="sp-btn sp-btn--primary" onClick={() => verify(true)}>Enregistrer quand même</button>
							) : (
								<button type="button" className="sp-btn sp-btn--primary" disabled={!key.trim() || status === 'verif'} onClick={() => verify()}>
									{status === 'verif' ? 'Vérification…' : 'Vérifier'}
								</button>
							)}
						</div>
					</>
				)}

				{step === 3 && (
					<>
						<span aria-hidden="true" style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--sp-surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', ['cornerShape' as any]: 'round' }}>
							<svg width="30" height="30" viewBox="0 0 24 24" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'var(--sp-online)' }}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
						</span>
						<h2 id="sp-sgdbw-title" className="sp-h2" style={{ fontSize: 21 }}>Clé enregistrée</h2>
						<p className="sp-muted" style={{ margin: 0, lineHeight: 1.55 }}>Sur la fiche d'un jeu, l'icône « Personnaliser les visuels », sur la bannière, ouvre le choix des jaquettes, bannières et logos.</p>
						<p className="sp-muted" style={{ margin: 0, fontSize: 12.5 }}>Cette fenêtre se rouvre à tout moment depuis Paramètres › SteamGridDB.</p>
						<div style={{ display: 'flex', paddingTop: 6 }}>
							<span style={{ flex: 1 }} />
							<button type="button" className="sp-btn sp-btn--primary" autoFocus onClick={onClose}>Terminer</button>
						</div>
					</>
				)}
			</section>
		</div>
	);
}
