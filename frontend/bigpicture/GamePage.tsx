// Big Picture › Fiche d'un jeu : bannière plein cadre, Jouer, Propriétés, copies familiales ;
// cartes Temps de jeu, Succès, Copie utilisée, Amis. X change de copie, Y personnalise les visuels.
import { useRef, useState } from 'react';
import { DialogButton, Focusable, Menu, MenuItem } from 'millennium';
import { avatarUrl, bpNavigate, formatLastPlayed, playOrInstall, ROUTES } from '../core/steam';
import { useSettings } from '../core/settings';
import { usePath } from '../core/history';
import { formatBigHours, forgetOwners, keyOf, plural } from '../pages/library/data';
import { primaryState, setPreferredCopy, useAchievements, useFriendsWithGame, useGame, useLenders } from '../pages/game/data';
import type { Copy } from '../pages/game/data';
import { BpFrame, goBackBp, MemberAvatar } from './Frame';
import { HeroImage, openArtworkBp, openPropertiesBp, showBpMenu } from './gameActions';

const ImageIcon = () => (
	<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<rect x="3" y="4" width="18" height="16" rx="2" />
		<circle cx="9" cy="10" r="2" />
		<path d="m21 16-5-5-9 9" />
	</svg>
);

function copyColor(c: Copy): string {
	return c.isMe ? 'var(--sp-accent)' : c.color || 'var(--sp-muted)';
}

function copyName(c: Copy): string {
	return c.isMe ? 'Votre copie' : keyOf(c.name);
}

/** Choix de la copie utilisée (menu manette natif). La copie actuelle vient en premier, là où arrive le focus :
 * un appui réflexe sur A ne change rien. */
function chooseCopy(appid: number, copies: Copy[], onChanged: () => void) {
	const ordered = [...copies].sort((a, b) => Number(b.preferred) - Number(a.preferred) || Number(b.isMe) - Number(a.isMe) || a.name.localeCompare(b.name, 'fr'));
	showBpMenu(
		<Menu label="Copie à utiliser">
			{ordered.map((c) => (
				<MenuItem
					key={c.accountId}
					onSelected={async () => {
						if (c.preferred) return;
						const ok = await setPreferredCopy(appid, c.accountId);
						if (ok) {
							forgetOwners(appid);
							onChanged();
						}
					}}
				>
					{copyName(c)}
					{c.preferred ? ' · utilisée' : ''}
				</MenuItem>
			))}
		</Menu>,
	);
}

function Card({ label, children }: { label: string; children: any }) {
	return (
		<div className="spbp-card">
			<span className="spbp-label">{label}</span>
			{children}
		</div>
	);
}

export function BpGame() {
	const s = useSettings();
	const path = usePath('bp');
	// pendant l'animation de sortie la route a déjà changé : on garde le jeu affiché (sinon « Jeu introuvable » un instant)
	const lastAppid = useRef(0);
	const fromPath = Number(path.match(/\/steamupgraded\/bp\/app\/(\d+)/)?.[1] || 0);
	if (fromPath) lastAppid.current = fromPath;
	const appid = lastAppid.current;
	const { app, details } = useGame(appid);
	const [version, setVersion] = useState(0);
	const copies = useLenders(appid, version);
	const ach = useAchievements(appid);
	const friends = useFriendsWithGame(appid);

	if (!app) {
		return (
			<BpFrame onBack={goBackBp} header={false}>
				<p style={{ margin: '80px 72px', fontSize: 26, color: 'var(--sp-muted)' }}>Jeu introuvable.</p>
			</BpFrame>
		);
	}

	const oled = s.bpTheme === 'oled';
	const st = primaryState(app);
	const several = !!copies && copies.length > 1;
	const used = copies?.find((c) => c.preferred) || copies?.find((c) => c.isMe) || copies?.[0];
	const size = Number(details?.lDiskUsageBytes || app.size_on_disk || 0);
	const status = app.installed ? `Installé${size ? ` · ${(size / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Go` : ''}` : 'Non installé';
	const mins = Number(app.minutes_playtime_forever || 0);
	const inGame = friends?.filter((f) => f.inGame).length || 0;
	const fade = oled
		? 'linear-gradient(to right, rgba(0,0,0,.72) 0%, rgba(0,0,0,0) 65%)'
		: 'linear-gradient(to bottom, transparent 45%, var(--sp-bg) 100%), linear-gradient(to right, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 60%)';
	const changeCopy = several ? () => chooseCopy(appid, copies!, () => setVersion((v) => v + 1)) : undefined;

	return (
		<BpFrame
			header={false}
			onBack={goBackBp}
			options={{ label: 'Visuels', run: () => openArtworkBp(app) }}
			secondary={changeCopy && { label: 'Changer de copie', run: changeCopy }}
			info={<span>Bibliothèque › {app.display_name}</span>}
		>
			{/* Bannière à la hauteur de l'écran : les cartes arrivent juste au-dessus du pied de page (16:9, 16:10…) */}
			<section aria-label="Bannière" data-reveal-block style={{ position: 'relative', height: 'clamp(560px, calc(var(--spbp-height) - 340px), 1000px)', background: 'var(--sp-surface2)', display: 'flex', alignItems: 'flex-end', padding: '0 72px 56px', overflow: 'hidden' }}>
				<HeroImage app={app} />
				<div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: fade }} />
				<div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 26, width: '100%' }}>
					<span style={{ fontSize: 88, fontWeight: 800, lineHeight: 0.95, color: '#fff', letterSpacing: '-0.01em', textShadow: '0 2px 20px rgba(0,0,0,.5)', maxWidth: 1400 }}>{app.display_name}</span>
					<Focusable flow-children="row" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
						<DialogButton className="spbp-btn spbp-btn--primary" noFocusRing autoFocus disabled={st.disabled} onClick={() => playOrInstall(app)} onOKActionDescription={st.label} style={{ height: 76, fontSize: 28 }}>
							<svg width="28" height="28" viewBox="0 0 24 24" fill={app.installed ? 'currentColor' : 'none'} stroke={app.installed ? 'none' : 'currentColor'} strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
								<path d={app.installed ? 'M7 4.5v15l12-7.5z' : 'M12 4v11M7 10l5 5 5-5M5 20h14'} />
							</svg>
							{st.label}
						</DialogButton>
						<DialogButton className="spbp-btn spbp-btn--glass" noFocusRing onClick={() => openPropertiesBp(appid)} onOKActionDescription="Ouvrir" style={{ height: 76 }}>
							Propriétés
						</DialogButton>
						{several && (
							<DialogButton className="spbp-btn spbp-btn--glass" noFocusRing onClick={changeCopy} onOKActionDescription="Changer de copie" style={{ height: 76, padding: '0 28px' }}>
								<span style={{ display: 'flex' }} aria-hidden="true">
									{copies!.slice(0, 4).map((c, i) => (
										<MemberAvatar key={c.accountId} accountId={c.accountId} color={copyColor(c)} size={32} style={{ marginLeft: i ? -6 : 0 }} />
									))}
								</span>
								{plural(copies!.length, 'copie', 'copies')}
							</DialogButton>
						)}
						<span style={{ marginLeft: 18, fontSize: 20, color: 'rgba(255,255,255,.8)' }}>{status}</span>
						<span style={{ flex: 1 }} />
						<DialogButton className="spbp-btn spbp-btn--glass spbp-btn--icon" noFocusRing aria-label="Personnaliser les visuels" onClick={() => openArtworkBp(app)} onOKActionDescription="Visuels">
							<ImageIcon />
						</DialogButton>
					</Focusable>
				</div>
			</section>

			<section aria-label="Infos" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 24, padding: '34px 72px 0' }}>
				<Card label="Temps de jeu">
					<span style={{ fontSize: 52, fontWeight: 800 }}>{mins ? formatBigHours(mins) : '0 h'}</span>
					<span style={{ fontSize: 18, color: 'var(--sp-muted)' }}>{app.rt_last_time_played ? `Dernière session ${formatLastPlayed(app.rt_last_time_played)}` : 'Jamais lancé'}</span>
				</Card>
				<DialogButton className="spbp-card spbp-card-btn" noFocusRing disabled={!ach.data?.total} onClick={() => bpNavigate(ROUTES.bpAchievements(appid))} onOKActionDescription="Voir les succès">
					<span className="spbp-label">Succès</span>
					{ach.data && ach.data.total > 0 ? (
						<>
							<span style={{ fontSize: 52, fontWeight: 800 }}>
								{ach.data.achieved} / {ach.data.total}
							</span>
							<span className="spbp-bar">
								<i style={{ width: `${Math.round((ach.data.achieved / ach.data.total) * 100)}%` }} />
							</span>
						</>
					) : (
						<span style={{ fontSize: 24, fontWeight: 700, color: 'var(--sp-muted)', marginTop: 12 }}>{ach.loading ? 'Chargement…' : 'Aucun succès'}</span>
					)}
				</DialogButton>
				<Card label="Copie utilisée">
					{used ? (
						<span style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
							<MemberAvatar accountId={used.accountId} color={copyColor(used)} size={52} />
							<span style={{ display: 'flex', flexDirection: 'column' }}>
								<span style={{ fontSize: 24, fontWeight: 800 }}>{copyName(used)}</span>
								<span style={{ fontSize: 17, color: 'var(--sp-muted)' }}>{several ? `${plural(copies!.length - 1, 'autre', 'autres')} dans la famille` : 'Seule copie'}</span>
							</span>
						</span>
					) : (
						<span style={{ fontSize: 24, fontWeight: 700, color: 'var(--sp-muted)', marginTop: 12 }}>{copies === null ? 'Chargement…' : 'Votre copie'}</span>
					)}
				</Card>
				<Card label="Contacts">
					{friends && friends.length ? (
						<>
							<span style={{ display: 'flex', marginTop: 4 }} aria-hidden="true">
								{friends.slice(0, 5).map((f) => {
									const src = f.avatar || avatarUrl(f.accountId);
									return src ? (
										<img key={f.accountId} src={src} alt="" style={{ width: 52, height: 52, borderRadius: '50%', border: '3px solid var(--sp-surface)', marginRight: -12, objectFit: 'cover', cornerShape: 'round' } as any} />
									) : (
										<span key={f.accountId} className="spbp-dot" style={{ width: 52, height: 52, background: 'var(--sp-surface2)', border: '3px solid var(--sp-surface)', marginRight: -12 }} />
									);
								})}
							</span>
							<span style={{ fontSize: 18, color: 'var(--sp-muted)' }}>
								{plural(friends.length, "contact l'a", "contacts l'ont")}
								{inGame ? ` · ${inGame} en jeu` : ''}
							</span>
						</>
					) : (
						<span style={{ fontSize: 24, fontWeight: 700, color: 'var(--sp-muted)', marginTop: 12 }}>{friends === null ? 'Chargement…' : 'Aucun contact ne l’a'}</span>
					)}
				</Card>
			</section>
		</BpFrame>
	);
}
