// Big Picture › chats de groupe (/steamupgraded/bp/groupes). État vide (aucun groupe) avec la création d'un
// groupe ; sinon la liste des groupes. Création et ouverture d'un groupe passent par l'onglet Contacts de
// l'accès rapide de Steam (habillé) : le détail d'un groupe (salons, membres) sera fait avec un groupe pour tester.
import { DialogButton, Focusable } from 'millennium';
import { bpRouter } from '../core/steam';
import { plural } from '../pages/library/data';
import { BpFrame, goBackBp, useClock } from './Frame';
import { useGroups } from './friends';

const openSteamGroups = () => bpRouter()?.MenuStore?.OpenQuickAccessMenu?.(3);

const GroupIcon = ({ size = 56 }: { size?: number }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d="M17 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 5 18.5V20M11 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1.4a3.4 3.4 0 0 0-2.4-3.2M15.5 4.2a3.5 3.5 0 0 1 0 6.6" />
	</svg>
);

export function BpGroups() {
	const groups = useGroups();
	const clock = useClock();
	return (
		<BpFrame header={false} onBack={goBackBp} info={<span>{groups.length ? plural(groups.length, 'chat de groupe', 'chats de groupe') : 'Chats de groupe'}</span>}>
			<header style={{ display: 'flex', alignItems: 'center', padding: '30px 64px 0' }}>
				<span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sp-muted)' }}>Contacts · Groupes</span>
				<span style={{ flex: 1 }} />
				<span className="spbp-clock">{clock}</span>
			</header>
			<Focusable flow-children="column" style={{ display: 'flex', flexDirection: 'column', gap: 26, padding: '34px 64px 200px' }}>
				{!groups.length ? (
					<div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 18, padding: '34px 32px', borderRadius: 30, border: '2px dashed var(--sp-line)', color: 'var(--sp-muted)' }}>
						<GroupIcon />
						<span style={{ fontSize: 30, fontWeight: 800, color: 'var(--sp-text)' }}>Aucun chat de groupe</span>
						<span style={{ fontSize: 20, lineHeight: 1.5 }}>Les chats de groupe auxquels vous participez apparaîtront ici.</span>
						<div style={{ display: 'flex' }}>
							<DialogButton className="spbp-btn spbp-btn--primary" noFocusRing autoFocus onClick={openSteamGroups} onOKActionDescription="Créer">
								+ Créer un chat de groupe
							</DialogButton>
						</div>
						<span style={{ fontSize: 17, lineHeight: 1.5 }}>La création se fait dans l’onglet Contacts de l’accès rapide de Steam (onglet Groupes).</span>
					</div>
				) : (
					<>
						<Focusable flow-children="grid" className="spbp-friend-grid">
							{groups.map((g, i) => (
								<DialogButton key={g.id || i} className="spbp-friend" noFocusRing autoFocus={i === 0} onClick={openSteamGroups} onOKActionDescription="Ouvrir" aria-label={`${g.name}${g.unread ? `, ${plural(g.unread, 'message non lu', 'messages non lus')}` : ''}`}>
									{g.avatar ? (
										<img src={g.avatar} alt="" style={{ width: 92, height: 92, borderRadius: 26, objectFit: 'cover' }} />
									) : (
										<span style={{ width: 92, height: 92, borderRadius: 26, background: 'var(--sp-surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sp-muted)' }}>
											<GroupIcon size={44} />
										</span>
									)}
									<span className="spbp-friend-text">
										<span className="spbp-friend-name">{g.name}</span>
										<span className="spbp-friend-status">{g.unread ? plural(g.unread, 'message non lu', 'messages non lus') : 'Chat de groupe'}</span>
									</span>
								</DialogButton>
							))}
						</Focusable>
						<div style={{ display: 'flex' }}>
							<DialogButton className="spbp-btn" noFocusRing onClick={openSteamGroups} onOKActionDescription="Créer">
								+ Créer un chat de groupe
							</DialogButton>
						</div>
					</>
				)}
			</Focusable>
		</BpFrame>
	);
}
