// Big Picture › Menu rapide (≡) : présence, téléchargement en cours, Actu, quitter Big Picture.
// C'est une route à part : le focus y reste enfermé et B (ou ≡) revient à l'écran précédent.
import { useEffect, useState } from 'react';
import { DialogButton, Focusable } from 'millennium';
import { bpRouter, PRESENCE, presenceState, setPresence } from '../core/steam';
import { useLibrary } from '../pages/library/data';
import { speedLabel } from '../shell/Downloads';
import { BpFrame, goBackBp, SelfAvatar, useClock, useDownload } from './Frame';
import { Cover } from './gameActions';
import { AlbumCover, IconNowPlaying, openPlayer, useNowPlaying } from './music';

const w = window as any;

function useCounts() {
	const read = () => ({
		online: Number(w.friendStore?.m_FriendsUIFriendStore?.GetOnlineFriendCount?.() ?? 0) || 0,
		unread: Number(w.NotificationStore?.m_nUnviewedNotifications ?? 0) || 0,
	});
	const [c, set] = useState(read);
	useEffect(() => {
		const id = setInterval(() => set(read()), 3000);
		return () => clearInterval(id);
	}, []);
	return c;
}

function SectionTitle({ id, children }: { id: string; children: any }) {
	return (
		<h2 id={id} className="spbp-label" style={{ margin: '0 0 4px' }}>
			{children}
		</h2>
	);
}

export function BpQuickMenu() {
	const [lib] = useLibrary();
	const clock = useClock();
	const dl = useDownload();
	const now = useNowPlaying();
	const counts = useCounts();
	const [state, setState] = useState(presenceState);
	const me = (w.friendStore?.m_FriendsUIFriendStore?.m_self?.m_persona?.m_strPlayerName as string) || '';
	const wallet = String(w.App?.m_CurrentUser?.strAccountBalance || '');
	const tiles = lib.games.filter((g) => g.last > 0).sort((a, b) => b.last - a.last).slice(0, 12);
	const qam = (tab: number) => bpRouter()?.MenuStore?.OpenQuickAccessMenu?.(tab);

	return (
		<BpFrame header={false} onBack={goBackBp} onMenu={goBackBp}>
			<div style={{ position: 'relative', height: '100%', minHeight: 1100 }}>
				<div aria-hidden="true" style={{ position: 'absolute', inset: 0, padding: '120px 64px', display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 26, opacity: 0.35, alignContent: 'start' }}>
					{tiles.map((g) => (
						<Cover key={g.appid} app={g.app} className="spbp-cover" />
					))}
				</div>
				<div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)' }} />
			</div>

			<aside aria-label="Menu rapide" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 620, background: 'var(--sp-surface)', borderLeft: '1px solid var(--sp-line)', padding: '40px 40px 0', display: 'flex', flexDirection: 'column', gap: 28, overflowY: 'auto' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
					<SelfAvatar size={72} ring="var(--sp-surface)" />
					<span style={{ display: 'flex', flexDirection: 'column' }}>
						<span style={{ fontSize: 30, fontWeight: 800 }}>{me}</span>
						{wallet && <span style={{ fontSize: 19, color: 'var(--sp-muted)' }}>Portemonnaie : {wallet}</span>}
					</span>
					<span style={{ flex: 1 }} />
					<span style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{clock}</span>
				</div>

				<Focusable flow-children="column" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
					<section aria-labelledby="spbp-pres" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
						<SectionTitle id="spbp-pres">Ma présence</SectionTitle>
						<Focusable flow-children="column" role="radiogroup" aria-labelledby="spbp-pres" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
							{PRESENCE.map((p) => (
								<DialogButton
									key={p.state}
									className="spbp-row"
									noFocusRing
									autoFocus={p.state === state}
									role="radio"
									aria-checked={p.state === state}
									onClick={() => {
										setPresence(p.state);
										setState(p.state);
									}}
									onOKActionDescription="Choisir"
								>
									<span className="spbp-dot" style={{ width: 16, height: 16, background: p.color }} />
									<span style={{ flex: 1 }}>{p.label}</span>
									{p.state === state && <span style={{ fontSize: 18, color: 'var(--sp-accent)', fontWeight: 800 }}>Actuel</span>}
								</DialogButton>
							))}
						</Focusable>
					</section>

					{now && (
						<section aria-labelledby="spbp-music" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
							<SectionTitle id="spbp-music">Musique</SectionTitle>
							<DialogButton className="spbp-row spbp-row--card" noFocusRing onClick={openPlayer} onOKActionDescription="Ouvrir le lecteur" style={{ minHeight: 84 }}>
								<AlbumCover app={now.app} size={56} radius={14} />
								<span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
									<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 800 }}>{now.track?.name || now.app?.display_name}</span>
									<span style={{ fontSize: 17, color: 'var(--sp-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
										{now.playing ? 'En cours de lecture' : 'En pause'} · {now.app?.display_name}
									</span>
								</span>
								{now.playing && <IconNowPlaying />}
							</DialogButton>
						</section>
					)}

					<section aria-labelledby="spbp-dl" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 22, borderRadius: 24, background: 'var(--spbp-card)', border: '1px solid var(--sp-line)' }}>
						<SectionTitle id="spbp-dl">Téléchargement</SectionTitle>
						{dl.active ? (
							<>
								<span style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 22, fontWeight: 700 }}>
									<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dl.name || 'Téléchargement'}</span>
									<span>{dl.paused ? 'En pause' : `${dl.pct} %`}</span>
								</span>
								<span className="spbp-bar">
									<i style={{ width: `${dl.pct}%` }} />
								</span>
								<span style={{ fontSize: 18, color: 'var(--sp-muted)' }}>
									{[dl.paused ? '' : speedLabel(dl.speed), dl.queued > 1 ? `${dl.queued - 1} en attente` : ''].filter(Boolean).join(' · ') || ' '}
								</span>
							</>
						) : (
							<span style={{ fontSize: 20, color: 'var(--sp-muted)' }}>Aucun téléchargement en cours</span>
						)}
					</section>

					<section aria-labelledby="spbp-actu" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
						<SectionTitle id="spbp-actu">Actu</SectionTitle>
						<Focusable flow-children="column" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
							<DialogButton className="spbp-row spbp-row--card" noFocusRing onClick={() => qam(0)} onOKActionDescription="Ouvrir">
								<span className="spbp-dot" style={{ width: 10, height: 10, background: counts.unread ? 'var(--sp-accent)' : 'var(--sp-line)' }} />
								{counts.unread ? `${counts.unread} notification${counts.unread > 1 ? 's' : ''} non lue${counts.unread > 1 ? 's' : ''}` : 'Notifications'}
							</DialogButton>
							<DialogButton className="spbp-row spbp-row--card" noFocusRing onClick={() => qam(3)} onOKActionDescription="Ouvrir" style={{ color: 'var(--sp-muted)' }}>
								{counts.online ? `${counts.online} contact${counts.online > 1 ? 's' : ''} en ligne · ` : ''}Contacts et chat
							</DialogButton>
						</Focusable>
					</section>

					<DialogButton className="spbp-btn" noFocusRing onClick={() => w.SteamClient?.UI?.ExitBigPictureMode?.()} onOKActionDescription="Quitter" style={{ height: 64, background: 'transparent', marginBottom: 'calc(var(--spbp-footer) + 24px)' } as any}>
						Quitter Big Picture
					</DialogButton>
				</Focusable>
			</aside>
		</BpFrame>
	);
}
