// Fenêtres de discussion : Steam ne distingue pas vos messages de ceux du contact dans le HTML.
// On marque vos blocs de messages (classe sp-self) pour que le thème les place à droite, à la couleur d'accent.
import { myAccountId, selfPersona } from '../core/steam';

const w = window as any;

/** Compte qui a écrit un bloc, lu dans les propriétés React du composant de Steam (null si introuvable). */
function blockAuthor(el: Element): number | null {
	const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
	let fiber = key ? (el as any)[key] : null;
	for (let i = 0; fiber && i < 8; i++, fiber = fiber.return) {
		const p = fiber.memoizedProps;
		const id = p?.block?.unAccountID ?? p?.block?.accountid ?? p?.friend?.accountid;
		if (typeof id === 'number' && id > 0) return id;
	}
	return null;
}

function tag(doc: Document) {
	const me = myAccountId();
	const myName = selfPersona().name;
	// React peut réécrire la classe d'un bloc en le redessinant : on remet la marque à chaque passage (auteur gardé en attribut)
	for (const block of doc.querySelectorAll('.ChatMessageBlock')) {
		let mark = block.getAttribute('data-sp-self');
		if (mark === null) {
			const author = blockAuthor(block);
			let self = author !== null && author === me;
			// repli : le nom affiché (blocs dont Steam n'expose pas l'auteur)
			if (author === null && myName) self = (block.querySelector('.speakerName')?.textContent || '').trim() === myName;
			mark = self ? '1' : '0';
			block.setAttribute('data-sp-self', mark);
		}
		if (block.classList.contains('sp-self') !== (mark === '1')) block.classList.toggle('sp-self', mark === '1');
	}
}

function watch(popup: any) {
	const doc: Document | undefined = popup?.window?.document;
	if (!doc || !/^chat_/.test(String(popup?.m_strName || '')) || (doc as any).__spChatSkin) return;
	(doc as any).__spChatSkin = true;
	const win = popup.window;
	let pending = false;
	const run = () => {
		pending = false;
		try {
			tag(doc);
		} catch {}
	};
	const observer = new win.MutationObserver(() => {
		if (pending) return;
		// fenêtre en cours de fermeture : on arrête de la suivre
		if (win.closed || !doc.defaultView) {
			observer.disconnect();
			return;
		}
		pending = true;
		win.requestAnimationFrame(run);
	});
	observer.observe(doc.body, { childList: true, subtree: true });
	run();
}

export function initChatSkin() {
	for (const p of w.g_PopupManager?.GetPopups?.() || []) watch(p);
	w.g_PopupManager?.AddPopupCreatedCallback?.((p: any) => setTimeout(() => watch(p), 300));
}
