// Big Picture › contacts et discussions : données lues dans le magasin de contacts et de chat de Steam
// (g_FriendsUIApp). Libellés d'état à nous : ceux de Steam sont genrés (« Absent(e) »).
import { useEffect, useState } from 'react';
import { myAccountId } from '../core/steam';

const w = window as any;

function friendStore(): any {
	return w.g_FriendsUIApp?.FriendStore || w.friendStore?.m_FriendsUIFriendStore;
}

function chatStore(): any {
	return w.g_FriendsUIApp?.ChatStore;
}

export type Friend = {
	accountId: number;
	steamId64: string;
	name: string;
	avatar: string;
	state: number;
	online: boolean;
	game: string;
	status: string;
	color: string;
	lastSeen: number;
	favorite: boolean;
	unread: number;
	lastChat: number;
	player: any;
};

/** « il y a 7 h », « il y a 3 j ». */
export function sinceLabel(rt: number): string {
	if (!rt) return '';
	const s = Math.max(0, Date.now() / 1000 - rt);
	if (s < 3600) return `il y a ${Math.max(1, Math.round(s / 60))} min`;
	if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
	if (s < 7 * 86400) return `il y a ${Math.round(s / 86400)} j`;
	return `il y a ${Math.round(s / (7 * 86400))} sem.`;
}

/** État d'un contact : 0 hors ligne, 1 en ligne, 2 ne pas déranger, 3 absence, 4 absence prolongée, 5-6 en ligne. */
function statusOf(state: number, game: string, lastSeen: number): { status: string; color: string; online: boolean } {
	if (game) return { status: `En jeu : ${game}`, color: 'var(--sp-online)', online: true };
	if (state === 0) return { status: `Hors ligne${lastSeen ? ` · ${sinceLabel(lastSeen)}` : ''}`, color: 'var(--sp-muted)', online: false };
	if (state === 2) return { status: 'Ne pas déranger', color: 'var(--sp-busy)', online: true };
	if (state === 3 || state === 4) return { status: 'Absence', color: 'var(--sp-away)', online: true };
	return { status: 'En ligne', color: 'var(--sp-online)', online: true };
}

export function readFriends(): Friend[] {
	const fs = friendStore();
	if (!fs) return [];
	const fcs = chatStore()?.m_FriendChatStore;
	const favs = new Set<number>((fs.m_FavoritesStore?.m_rgFavorites || []).map((f: any) => f?.friend?.accountid).filter(Boolean));
	const out: Friend[] = [];
	for (const id of fs.m_setFriendAccountIDs || []) {
		const player = fs.m_mapPlayerCache?.get(id);
		const p = player?.persona;
		if (!p) continue;
		const game = p.m_gameid && p.m_gameid !== '0' ? String(player.current_game_name || '') : '';
		const lastSeen = Number(p.m_rtLastSeenOnline || 0);
		const state = Number(p.m_ePersonaState || 0);
		const chat = fcs?.GetFriendChat?.(id, false);
		out.push({
			accountId: id,
			steamId64: String(player.steamid64 || ''),
			name: String(player.display_name || p.m_strPlayerName || ''),
			avatar: String(p.avatar_url_medium || ''),
			state,
			lastSeen,
			favorite: favs.has(id),
			unread: Number(chat?.unread_message_count || 0),
			lastChat: Number(fcs?.GetFriendLastChatTime?.(id) || 0),
			player,
			game,
			...statusOf(state, game, lastSeen),
		});
	}
	return out.sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, 'fr'));
}

const sig = (list: Friend[]) => list.map((f) => `${f.accountId}:${f.state}:${f.game}:${f.unread}:${f.favorite}:${f.name}:${f.lastChat}`).join('|');

/** Contacts, relus toutes les deux secondes (états, jeux, messages non lus). */
export function useFriends(): Friend[] {
	const [list, set] = useState<Friend[]>(readFriends);
	useEffect(() => {
		let last = sig(list);
		const id = setInterval(() => {
			const next = readFriends();
			const s = sig(next);
			if (s !== last) {
				last = s;
				set(next);
			}
		}, 2000);
		return () => clearInterval(id);
	}, []);
	return list;
}

export function friendChat(accountId: number): any {
	return chatStore()?.m_FriendChatStore?.GetFriendChat?.(accountId, true);
}

export type Message = { key: string; mine: boolean; author: number; text: string; time: number; system: boolean; failed: boolean };

/** Balises BBCode de Steam (seulement celles-là : un message peut contenir des crochets ordinaires). */
const BBCODE = /\[\/?(b|i|u|s|spoiler|code|quote|noparse|url|img|emoticon|sticker|mention|lobbyinvite|gameinvite|tradeoffer|roomeffect|random|flip|giphy|h1|h2|h3|hr|list|olist|\*|table|tr|th|td)(=[^\]]*)?( [^\]]*)?\]/gi;

/** Texte lisible d'un message : sans balises BBCode de Steam (émoticônes, liens, images). */
function plain(text: string): string {
	return String(text || '')
		.replace(/\[emoticon\]([^[]*)\[\/emoticon\]/gi, ':$1:')
		.replace(/\[url=([^\]]*)\]([^[]*)\[\/url\]/gi, '$2')
		.replace(BBCODE, '')
		.trim();
}

function readMessages(chat: any): Message[] {
	const me = myAccountId();
	return (chat?.chat_messages || []).map((m: any) => ({
		key: String(m.UniqueKey?.() ?? `${m.rtTimestamp}:${m.unOrdinal}`),
		mine: Number(m.unAccountID) === me,
		author: Number(m.unAccountID),
		text: plain(m.BIsServerMessage?.() ? m.strServerMsgAppCustomLocalized || '' : m.strMessage),
		time: Number(m.rtTimestamp || 0),
		system: !!m.BIsServerMessage?.(),
		failed: !!(typeof m.eErrorSending === 'function' ? m.eErrorSending() : m.eErrorSending),
	}));
}

/** Conversation : historique chargé à l'ouverture, messages relus pendant qu'elle est affichée, lus en l'ouvrant. */
export function useConversation(chat: any) {
	const [state, set] = useState<{ messages: Message[]; typing: boolean; loading: boolean }>({ messages: [], typing: false, loading: true });
	useEffect(() => {
		if (!chat) return undefined;
		let alive = true;
		let last = '';
		const read = () => {
			const messages = readMessages(chat);
			const typing = !!chat.is_friend_typing;
			const s = `${messages.length}:${messages[messages.length - 1]?.key || ''}:${typing}`;
			if (s !== last) {
				last = s;
				set({ messages, typing, loading: false });
				// la conversation est affichée : ses messages sont lus
				try {
					chat.OnActivate?.();
				} catch {}
			}
		};
		set({ messages: readMessages(chat), typing: false, loading: true });
		Promise.resolve(chat.LoadChatLogs?.())
			.catch(() => {})
			.finally(() => {
				if (!alive) return;
				last = '';
				read();
				set((s) => ({ ...s, loading: false }));
			});
		const id = setInterval(read, 700);
		return () => {
			alive = false;
			clearInterval(id);
		};
	}, [chat]);
	return state;
}

/** Envoie un message (la file d'envoi de Steam gère les nouvelles tentatives). */
export function sendMessage(chat: any, text: string) {
	const t = text.trim();
	if (t) chat?.SendChatMessage?.(t);
}

export function openProfile(f: Friend) {
	if (f.steamId64) w.SteamClient?.URL?.ExecuteSteamURL?.(`steam://url/SteamIDPage/${f.steamId64}`);
}

export function toggleVoice(chat: any) {
	chat?.ToggleVoiceChat?.();
}

export function voiceActive(chat: any): boolean {
	try {
		return !!chat?.BVoiceActive?.();
	} catch {
		return false;
	}
}

// ---------- Chats de groupe ----------

export type Group = { id: string; name: string; avatar: string; unread: number; group: any };

export function readGroups(): Group[] {
	const map = chatStore()?.m_mapChatGroups;
	if (!map) return [];
	return [...map.values()].map((g: any) => ({
		id: String(g.GetGroupID?.() ?? g.unique_id ?? g.m_ulGroupID ?? ''),
		name: String(g.name || g.m_strName || ''),
		avatar: String(g.avatar_url_medium || g.GetAvatarURL?.('medium') || ''),
		unread: Number(g.unread_message_count || 0),
		group: g,
	}));
}

export function useGroups(): Group[] {
	const [list, set] = useState<Group[]>(readGroups);
	useEffect(() => {
		const id = setInterval(() => set((cur) => (cur.length === readGroups().length ? cur : readGroups())), 3000);
		return () => clearInterval(id);
	}, []);
	return list;
}
