// Paramètres › Apparence (et réglages du plugin).
import { useEffect, useState } from 'react';
import { ACCENTS, FONDS } from '../core/theme';
import { getSettings, setSetting, Settings as S, useSettings } from '../core/settings';
import { NATIVE_GROUPS, RootMenu, runNativeMenuItem } from '../core/nativeMenu';
import { onSteamPageRequested, SteamSettingsPanel, takeRequestedSteamPage, useSteamPages } from '../features/steamSettings';
import { SgdbWelcome } from '../features/sgdb/Welcome';
import { UpdatesPanel } from '../features/uninstall';
import { usePageTransition } from '../core/transitions';
import { presenceState, schedulePresenceReturn } from '../core/steam';

const Check = () => <span style={{ color: 'var(--sp-accent)', fontWeight: 800 }}>✓</span>;

function Toggle({ k, label, sub }: { k: keyof S; label: string; sub: string }) {
	const s = useSettings();
	const on = !!s[k];
	return (
		<label style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 52, padding: '6px 4px', borderTop: '1px solid var(--sp-line)', cursor: 'pointer' }}>
			<span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
				<span style={{ fontWeight: 700 }}>{label}</span>
				<span className="sp-muted" style={{ fontSize: 12 }}>{sub}</span>
			</span>
			<button type="button" role="switch" aria-checked={on} className="sp-switch" onClick={() => setSetting(k, !on as any)} />
		</label>
	);
}

function Section({ id, title, sub, children }: { id: string; title: string; sub?: string; children: any }) {
	return (
		<section aria-labelledby={id} className="sp-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
				<h2 id={id} className="sp-h2" style={{ fontSize: 17 }}>{title}</h2>
				{sub && <span className="sp-muted">{sub}</span>}
			</div>
			{children}
		</section>
	);
}

const CATS = ['Apparence', 'Présence', 'Bibliothèque', 'SteamGridDB', 'Actions de Steam', 'Mises à jour'] as const;

function NativeActions() {
	const [busy, setBusy] = useState('');
	const [missing, setMissing] = useState('');
	const run = async (menu: RootMenu, item: string) => {
		setBusy(item);
		setMissing('');
		const ok = await runNativeMenuItem(menu, item);
		setBusy('');
		if (!ok) setMissing(item);
	};
	return (
		<>
			{NATIVE_GROUPS.map((g) => (
				<Section key={g.title} id={`h-native-${g.menu}`} title={g.title}>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
						{g.items.map((it) => (
							<button key={it} type="button" className="sp-btn" disabled={busy === it} onClick={() => run(g.menu, it)}>
								{it}
							</button>
						))}
					</div>
				</Section>
			))}
			{missing && <p className="sp-muted" role="status">« {missing} » n'a pas été trouvé dans le menu de Steam.</p>}
		</>
	);
}

const STEAM = 'steam:';

function NavItem({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
	return (
		<button type="button" onClick={onClick} aria-current={on ? 'page' : undefined} style={{ textAlign: 'left', padding: '9px 14px', border: 0, borderRadius: 'var(--sp-r-sm)', background: on ? 'var(--sp-surface2)' : 'transparent', fontWeight: on ? 700 : 500, color: on ? 'var(--sp-text)' : 'var(--sp-muted)' }}>
			{label}
		</button>
	);
}

const groupLabel = (top: number): any => ({ padding: `${top}px 14px 8px` });

export function SettingsPage() {
	const pageRef = usePageTransition();
	const s = useSettings();
	// catégorie : une des nôtres, ou « steam:<route> » pour une page native
	const [cat, setCat] = useState<string>(() => {
		const r = takeRequestedSteamPage();
		return r ? STEAM + r : 'Apparence';
	});
	const [key, setKey] = useState(s.sgdbKey);
	const [welcome, setWelcome] = useState(false);
	const steamPages = useSteamPages();
	const oled = s.theme === 'oled';
	const steamRoute = cat.startsWith(STEAM) ? cat.slice(STEAM.length) : '';

	useEffect(
		() =>
			onSteamPageRequested(() => {
				const r = takeRequestedSteamPage();
				if (r) setCat(STEAM + r);
			}),
		[],
	);

	return (
		<div className="sp-root" ref={pageRef}>
			<div style={{ display: 'flex', minHeight: '100%' }}>
				<nav aria-label="Catégories de paramètres" style={{ width: 240, flex: 'none', padding: '20px 16px 32px', borderRight: '1px solid var(--sp-line)', display: 'flex', flexDirection: 'column', gap: 2 }}>
					<span className="sp-label" style={groupLabel(6)}>Steam Upgraded</span>
					{CATS.map((c) => (
						<NavItem key={c} label={c} on={cat === c} onClick={() => setCat(c)} />
					))}
					{steamPages.length > 0 && <span className="sp-label" style={groupLabel(22)}>Steam</span>}
					{steamPages.map((p, i) =>
						p === 'separator' ? (
							<span key={`sep${i}`} aria-hidden="true" style={{ height: 1, margin: '6px 14px', background: 'var(--sp-line)' }} />
						) : (
							<NavItem key={p.route} label={p.title} on={steamRoute === p.route} onClick={() => setCat(STEAM + p.route)} />
						),
					)}
				</nav>
				<main style={{ flex: 1, minWidth: 0, padding: '28px 40px 56px', display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1000 }}>
					{steamRoute && <SteamSettingsPanel route={steamRoute} />}
					{!steamRoute && <h1 className="sp-h1">{cat}</h1>}

					{cat === 'Apparence' && (
						<>
							<Section id="h-theme" title="Thème" sub="Les deux sont sombres. OLED pousse les noirs à zéro : les pixels s'éteignent vraiment.">
								<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
									{(['sombre', 'oled'] as const).map((t) => {
										const f = FONDS[s.fond] || FONDS.nuit;
										const bg = t === 'oled' ? '#000' : f.c[0];
										const card = t === 'oled' ? '#000' : f.c[1];
										const line = t === 'oled' ? f.c[2] : f.c[3];
										const on = s.theme === t;
										return (
											<button key={t} type="button" aria-pressed={on} onClick={() => setSetting('theme', t)} style={{ padding: 0, border: `2px solid ${on ? 'var(--sp-accent)' : 'var(--sp-line)'}`, borderRadius: 'var(--sp-r-lg)', background: bg, overflow: 'hidden', textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
												<span aria-hidden="true" style={{ display: 'flex', gap: 10, padding: 16, height: 110 }}>
													<span style={{ width: 54, borderRadius: 'var(--sp-r-sm)', background: '#7a2d3b' }} />
													<span style={{ width: 54, borderRadius: 'var(--sp-r-sm)', background: '#21405a' }} />
													<span style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 10, borderRadius: 'var(--sp-r-md)', background: card, border: `1px solid ${line}` }}>
														<span style={{ height: 22, width: 64, borderRadius: 9, background: 'var(--sp-accent)', boxShadow: t === 'oled' ? '0 0 18px var(--sp-accent)' : 'none' }} />
													</span>
												</span>
												<span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: `1px solid ${line}`, color: '#eef2f6' }}>
													<span style={{ display: 'flex', flexDirection: 'column' }}>
														<span style={{ fontWeight: 800 }}>{t === 'oled' ? 'OLED' : 'Sombre'}</span>
														<span style={{ fontSize: 12, color: '#9aa3b2' }}>{t === 'oled' ? 'Noir absolu, contours fins, halos' : 'Sombre classique, teinte au choix'}</span>
													</span>
													{on && <Check />}
												</span>
											</button>
										);
									})}
								</div>
								<div>
									<Toggle k="oledHalo" label="Halo lumineux sur l'accent" sub="Les boutons et éléments à l'accent brillent légèrement, dans les deux thèmes" />
									{oled && (
										<>
											<Toggle k="oledNoFill" label="Cartes sans fond" sub="Uniquement des contours fins, le noir reste éteint" />
											<Toggle k="antiBurn" label="Protection anti-marquage" sub="Atténue les barres fixes après 5 min sans activité" />
										</>
									)}
								</div>
							</Section>

							<Section id="h-acc" title="Couleur d'accent" sub="Seules des teintes lisibles sur fond sombre sont proposées.">
								<div role="radiogroup" aria-label="Couleur d'accent" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
									{Object.entries(ACCENTS).map(([id, a]) => {
										const on = s.accent === id;
										return (
											<button key={id} type="button" role="radio" aria-checked={on} onClick={() => setSetting('accent', id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 6, width: 76, border: `2px solid ${on ? a.hex : 'transparent'}`, borderRadius: 'var(--sp-r-md)', background: 'transparent' }}>
												<span style={{ width: 48, height: 48, borderRadius: 'var(--sp-r-md)', background: a.hex, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0a0d12', fontWeight: 800 }}>{on ? '✓' : ''}</span>
												<span style={{ fontSize: 12, fontWeight: 600 }}>{a.label}</span>
											</button>
										);
									})}
								</div>
							</Section>

							{/* En OLED tout est noir : la teinte du fond n'a pas lieu d'être */}
							{!oled && (
							<Section id="h-fond" title="Teinte du fond" sub="La luminosité reste très basse : le texte reste lisible avec toutes les teintes.">
								<div role="radiogroup" aria-label="Teinte du fond" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 12 }}>
									{Object.entries(FONDS).map(([id, f]) => {
										const on = s.fond === id;
										return (
											<button key={id} type="button" role="radio" aria-checked={on} onClick={() => setSetting('fond', id)} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 6, border: `2px solid ${on ? 'var(--sp-accent)' : 'transparent'}`, borderRadius: 'var(--sp-r-md)', background: 'transparent', textAlign: 'left', alignItems: 'stretch' }}>
												<span aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', height: 60, padding: 8, borderRadius: 'var(--sp-r-md)', background: oled ? '#000' : f.c[0], border: `1px solid ${oled ? f.c[2] : f.c[3]}` }}>
													<span style={{ flex: 1, height: 22, borderRadius: 8, background: oled ? '#000' : f.c[1], border: `1px solid ${oled ? f.c[2] : f.c[3]}` }} />
												</span>
												<span style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', fontSize: 13, fontWeight: 700 }}>
													<span>{f.label}</span>
													{on && <Check />}
												</span>
											</button>
										);
									})}
								</div>
							</Section>
							)}

							<Section id="h-forme" title="Formes" sub="Le squircle adoucit les coins de tout : jaquettes, cartes, boutons, avatars.">
								<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
									{(['squircle', 'classique'] as const).map((f) => {
										const on = s.forme === f;
										return (
											<button key={f} type="button" aria-pressed={on} onClick={() => setSetting('forme', f)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', border: `2px solid ${on ? 'var(--sp-accent)' : 'transparent'}`, borderRadius: 'var(--sp-r-md)', background: 'var(--sp-surface2)', textAlign: 'left' }}>
												<span aria-hidden="true" style={{ display: 'flex', gap: 8 }}>
													<span style={{ width: 40, height: 60, borderRadius: f === 'squircle' ? 14 : 7, background: '#7a2d3b', ['cornerShape' as any]: f === 'squircle' ? 'squircle' : 'round' }} />
													<span style={{ width: 40, height: 60, borderRadius: f === 'squircle' ? 14 : 7, background: '#21405a', ['cornerShape' as any]: f === 'squircle' ? 'squircle' : 'round' }} />
												</span>
												<span style={{ flex: 1, fontWeight: 800 }}>{f === 'squircle' ? 'Squircle' : 'Arrondi classique'}</span>
												{on && <Check />}
											</button>
										);
									})}
								</div>
							</Section>

							<Section id="h-hdr" title="HDR" sub="Nécessite le HDR activé dans Windows. Rien ne change sur un écran SDR.">
								<div>
									<Toggle k="hdrWide" label="Couleurs étendues et images HDR" sub="Accents en Display P3 et visuels HDR affichés sans être écrasés" />
									<Toggle k="hdrHalo" label="Luminosité HDR maximale pour les images" sub="Les jaquettes HDR peuvent dépasser le blanc standard" />
								</div>
							</Section>

							<Section id="h-bp" title="Big Picture" sub="Thème propre à Big Picture, souvent affiché sur une télévision. L'accent et les formes suivent les réglages ci-dessus.">
								<div style={{ display: 'flex', gap: 8 }}>
									<button type="button" className="sp-pill" aria-pressed={s.bpTheme === 'oled'} onClick={() => setSetting('bpTheme', 'oled')}>OLED</button>
									<button type="button" className="sp-pill" aria-pressed={s.bpTheme === 'sombre'} onClick={() => setSetting('bpTheme', 'sombre')}>Sombre</button>
								</div>
							</Section>
						</>
					)}

					{cat === 'Présence' && (
						<Section id="h-pres" title="Présence" sub="Le sélecteur est toujours visible en haut à droite.">
							<label style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
								<span style={{ flex: 1 }}>Revenir automatiquement « En ligne » après (minutes, 0 = jamais)</span>
								<input className="sp-input" type="number" min={0} step={15} value={s.presenceReturnMinutes} onChange={(e) => {
									const m = Math.max(0, Number((e.target as HTMLInputElement).value) || 0);
									setSetting('presenceReturnMinutes', m);
									schedulePresenceReturn(m, presenceState());
								}} style={{ width: 100 }} />
							</label>
						</Section>
					)}

					{cat === 'Bibliothèque' && (
						<Section id="h-lib" title="Bibliothèque">
							<div>
								<Toggle k="replaceLibrary" label="Remplacer la bibliothèque de Steam" sub="Désactivé : la bibliothèque d'origine revient" />
								<Toggle k="replaceGamePage" label="Remplacer la fiche des jeux" sub="Désactivé : la page d'origine de chaque jeu revient" />
								<Toggle k="replaceBigPicture" label="Remplacer Big Picture" sub="Accueil, bibliothèque et fiche des jeux à la manette ; désactivé : Big Picture d'origine" />
							</div>
							<div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
								<span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
									<span style={{ fontWeight: 700 }}>Infos des tuiles</span>
									<span className="sp-muted" style={{ fontSize: 12 }}>Rien n'est posé sur la jaquette : infos dessous, ou seulement au survol.</span>
								</span>
								<button type="button" className="sp-pill" aria-pressed={s.infos === 'sous'} onClick={() => setSetting('infos', 'sous')}>Sous la jaquette</button>
								<button type="button" className="sp-pill" aria-pressed={s.infos === 'survol'} onClick={() => setSetting('infos', 'survol')}>Au survol</button>
							</div>
						</Section>
					)}

					{cat === 'Actions de Steam' && <NativeActions />}

					{cat === 'Mises à jour' && <UpdatesPanel Section={Section} />}

					{cat === 'SteamGridDB' && (
						<Section id="h-sgdb" title="SteamGridDB" sub="Pour choisir d'autres jaquettes, bannières et logos, il faut une clé API gratuite. Ça prend une minute.">
							<ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
								<li>Ouvrez la page SteamGridDB avec le bouton ci-dessous et connectez-vous avec votre compte Steam.</li>
								<li>Dans la section API, cliquez sur « Generate API Key ».</li>
								<li>Copiez la clé, collez-la ici, puis cliquez sur Enregistrer.</li>
							</ol>
							<div>
								<button type="button" className="sp-btn" onClick={() => (window as any).SteamClient.System.OpenInSystemBrowser('https://www.steamgriddb.com/profile/preferences/api')}>
									Créer ma clé sur SteamGridDB
								</button>
							</div>
							<div style={{ display: 'flex', gap: 10 }}>
								<input className="sp-input" type="password" placeholder="Collez votre clé API ici" value={key} onChange={(e) => setKey((e.target as HTMLInputElement).value)} style={{ flex: 1 }} aria-label="Clé API SteamGridDB" />
								<button type="button" className="sp-btn sp-btn--primary" onClick={() => setSetting('sgdbKey', key.trim())}>Enregistrer</button>
							</div>
							<span className="sp-muted" style={{ fontSize: 13 }}>{s.sgdbKey ? 'Clé enregistrée.' : 'Aucune clé pour l’instant.'}</span>
							<div>
								<button type="button" className="sp-btn" onClick={() => setWelcome(true)}>Revoir l'accueil</button>
							</div>
						</Section>
					)}
					{welcome && (
						<SgdbWelcome
							onClose={() => {
								setWelcome(false);
								setKey(getSettings().sgdbKey);
							}}
						/>
					)}
				</main>
			</div>
		</div>
	);
}
