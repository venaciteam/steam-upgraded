// Big Picture › discussion avec un contact (/steamupgraded/bp/discussion/:accountid) : liste des conversations
// à gauche, conversation à droite. A sur la barre de saisie ouvre le clavier virtuel ; Entrée (ou le bouton)
// envoie. LB/RB passent à la conversation précédente/suivante ; haut depuis la saisie remonte l'historique.
import { useEffect, useRef, useState } from 'react';
import { DialogButton, Focusable, GamepadButton, TextField } from 'millennium';
import { bpNavigate, ROUTES } from '../core/steam';
import { usePath } from '../core/history';
import { BpFrame, goBackBp, useClock } from './Frame';
import { Avatar } from './Contacts';
import { friendChat, openProfile, sendMessage, toggleVoice, useConversation, useFriends, voiceActive } from './friends';
import type { Friend, Message } from './friends';

const time = (rt: number) => new Date(rt * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

function dayLabel(rt: number): string {
	const d = new Date(rt * 1000);
	const today = new Date();
	const yesterday = new Date(Date.now() - 86400000);
	if (d.toDateString() === today.toDateString()) return 'Aujourd’hui';
	if (d.toDateString() === yesterday.toDateString()) return 'Hier';
	const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
	return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Conversations : non lues d'abord, puis les plus récentes, puis les contacts en ligne. */
function ordered(friends: Friend[]): Friend[] {
	return [...friends].sort((a, b) => b.unread - a.unread || b.lastChat - a.lastChat || Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, 'fr'));
}

const VoiceIcon = () => (
	<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
		<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM19 11a7 7 0 0 1-14 0M12 18v3" />
	</svg>
);

const SendIcon = () => (
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d="M4 12l16-8-6 16-3-7z" />
	</svg>
);

function Bubble({ m, name }: { m: Message; name: string }) {
	if (m.system)
		return m.text ? (
			<Focusable className="spbp-msg spbp-msg--system" noFocusRing {...({ focusable: true } as any)}>
				{m.text}
			</Focusable>
		) : null;
	return (
		// focalisable pour remonter l'historique à la manette (le défilement suit le focus)
		<Focusable className={`spbp-msg${m.mine ? ' spbp-msg--mine' : ''}`} noFocusRing {...({ focusable: true } as any)} aria-label={`${m.mine ? 'Vous' : name}, ${time(m.time)} : ${m.text}`}>
			<span className="spbp-msg-text">{m.text}</span>
			<span className="spbp-msg-meta">
				{m.mine ? 'Vous' : name} · {time(m.time)}
				{m.failed ? ' · Non envoyé' : ''}
			</span>
		</Focusable>
	);
}

export function BpChat() {
	const path = usePath('bp');
	const lastId = useRef(0);
	const fromPath = Number(path.match(/\/steamupgraded\/bp\/discussion\/(\d+)/)?.[1] || 0);
	if (fromPath) lastId.current = fromPath;
	const accountId = lastId.current;
	const friends = useFriends();
	const list = ordered(friends);
	const friend = friends.find((f) => f.accountId === accountId);
	const [chat, setChat] = useState<any>(null);
	useEffect(() => setChat(accountId ? friendChat(accountId) : null), [accountId]);
	const { messages, typing, loading } = useConversation(chat);
	const [text, setText] = useState('');
	const [voice, setVoice] = useState(false);
	const clock = useClock();
	const logRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => setText(''), [accountId]);
	useEffect(() => {
		const id = setInterval(() => setVoice(voiceActive(chat)), 1000);
		return () => clearInterval(id);
	}, [chat]);
	// nouveau message : on descend en bas de la conversation
	useEffect(() => {
		const el = logRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [messages.length, typing, accountId]);

	const open = (id: number) => bpNavigate(ROUTES.bpChat(id));
	const step = (d: number) => {
		const i = list.findIndex((f) => f.accountId === accountId);
		const next = list[i + d];
		if (next) open(next.accountId);
	};
	const onButtonDown = (e: any) => {
		const b = e?.detail?.button;
		if (b === GamepadButton.BUMPER_LEFT) step(-1);
		if (b === GamepadButton.BUMPER_RIGHT) step(1);
	};
	const send = () => {
		if (!text.trim()) return;
		sendMessage(chat, text);
		setText('');
	};

	let lastDay = '';
	const name = friend?.name || '';

	return (
		<BpFrame header={false} onBack={goBackBp} secondary={friend ? { label: 'Profil', run: () => openProfile(friend) } : undefined} info={<span>{friend ? `Discussion avec ${name}` : 'Discussions'}</span>}>
			<Focusable flow-children="row" onButtonDown={onButtonDown} style={{ display: 'flex', height: 'calc(var(--spbp-height) - var(--spbp-footer) - 24px)' }}>
				<aside aria-label="Discussions" style={{ width: 440, flex: 'none', display: 'flex', flexDirection: 'column', gap: 16, padding: '30px 26px 0 64px', borderRight: '1px solid var(--sp-line)', boxSizing: 'border-box', overflowY: 'auto' }}>
					<span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sp-muted)' }}>Contacts · Discussions</span>
					<Focusable flow-children="column" style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 24 }}>
						{list.map((f) => (
							<DialogButton key={f.accountId} className="spbp-friend spbp-friend--row spbp-friend--chat" noFocusRing aria-current={f.accountId === accountId ? 'true' : undefined} onClick={() => open(f.accountId)} onOKActionDescription="Ouvrir">
								<Avatar f={f} size={50} ring="var(--sp-bg)" />
								<span className="spbp-friend-text">
									<span className="spbp-friend-name">{f.name}</span>
									<span className="spbp-friend-status" style={{ color: f.online ? f.color : undefined }}>
										{f.status}
									</span>
								</span>
								{f.unread > 0 && f.accountId !== accountId && (
									<span className="spbp-badge-count" aria-label={`${f.unread} non lus`}>
										{f.unread}
									</span>
								)}
							</DialogButton>
						))}
					</Focusable>
				</aside>

				{!friend ? (
					<p style={{ margin: '60px 56px', fontSize: 24, color: 'var(--sp-muted)' }}>Choisissez un contact à gauche.</p>
				) : (
					// colonne de navigation : en-tête, messages, puis saisie (bas/haut passe de l'un à l'autre)
					<Focusable flow-children="column" role="region" aria-label={`Discussion avec ${name}`} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18, padding: '30px 64px 0 56px' }}>
						<header style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
							<Avatar f={friend} size={72} />
							<span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
								<span style={{ fontSize: 32, fontWeight: 800 }}>{name}</span>
								<span style={{ fontSize: 19, fontWeight: 700, color: friend.online ? friend.color : 'var(--sp-muted)' }}>{friend.status}</span>
							</span>
							<span style={{ flex: 1 }} />
							<Focusable flow-children="row" style={{ display: 'flex', gap: 12 }}>
								<DialogButton className="spbp-btn spbp-btn--compact" noFocusRing onClick={() => openProfile(friend)} onOKActionDescription="Profil">
									Profil
								</DialogButton>
								<DialogButton className={`spbp-btn spbp-btn--compact${voice ? ' spbp-btn--primary' : ''}`} noFocusRing onClick={() => toggleVoice(chat)} onOKActionDescription={voice ? 'Raccrocher' : 'Appel vocal'}>
									<VoiceIcon />
									{voice ? 'Raccrocher' : 'Appel vocal'}
								</DialogButton>
							</Focusable>
							<span className="spbp-clock" style={{ marginLeft: 12 }}>
								{clock}
							</span>
						</header>

						<div ref={logRef} role="log" aria-label="Messages" style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none' } as any}>
							<Focusable flow-children="column" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 12, padding: '8px 4px' }}>
								{loading && !messages.length && <span style={{ fontSize: 20, color: 'var(--sp-muted)' }}>Chargement de la discussion…</span>}
								{!loading && !messages.length && <span style={{ alignSelf: 'center', fontSize: 20, color: 'var(--sp-muted)' }}>Aucun message avec {name} pour l’instant.</span>}
								{messages.map((m) => {
									const day = dayLabel(m.time);
									const sep = day !== lastDay;
									lastDay = day;
									return (
										<div key={m.key} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
											{sep && (
												<span className="spbp-day" role="separator">
													{day}
												</span>
											)}
											<Bubble m={m} name={name} />
										</div>
									);
								})}
								{typing && <span style={{ fontSize: 17, color: 'var(--sp-muted)' }}>{name} écrit…</span>}
							</Focusable>
						</div>

						<Focusable flow-children="row" style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 20 }}>
							<div className="spbp-search" style={{ height: 72 }}>
								<TextField
									value={text}
									focusOnMount
									onChange={(e) => setText(e.target.value)}
									{...({ placeholder: `Écrire à ${name}`, onKeyDown: (e: any) => e.key === 'Enter' && (e.preventDefault(), send()) } as any)}
									aria-label={`Écrire à ${name}`}
								/>
							</div>
							<DialogButton className="spbp-btn spbp-btn--primary spbp-btn--icon" noFocusRing disabled={!text.trim()} aria-label="Envoyer" onClick={send} onOKActionDescription="Envoyer">
								<SendIcon />
							</DialogButton>
						</Focusable>
					</Focusable>
				)}
			</Focusable>
		</BpFrame>
	);
}
