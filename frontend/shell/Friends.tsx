// Bouton « Contacts et chat », au bout de la pilule Actu (remplace celui de la barre du bas de Steam).
import { useEffect, useState } from 'react';
import { runNativeMenuItem } from '../core/nativeMenu';

const w = window as any;

function onlineCount(): number {
	try {
		return Number(w.friendStore?.m_FriendsUIFriendStore?.GetOnlineFriendCount?.() ?? 0) || 0;
	} catch {
		return 0;
	}
}

export function FriendsButton() {
	const [n, setN] = useState(onlineCount);
	useEffect(() => {
		const id = setInterval(() => setN(onlineCount()), 5000);
		return () => clearInterval(id);
	}, []);
	const label = `Contacts et chat${n ? ` · ${n} en ligne` : ''}`;
	return (
		<button type="button" className="sp-friends" aria-label={label} title={label} onClick={() => runNativeMenuItem('Afficher', 'Contacts et chat')}>
			<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
				<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
				<circle cx="9" cy="7" r="4" />
				<path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
			</svg>
			{n > 0 && <span className="sp-friends-n">{n}</span>}
		</button>
	);
}
