// Habillage des écrans et menus natifs de Big Picture (Paramètres, Propriétés, Médias, dialogues, menu Steam,
// accès rapide, notifications, clavier virtuel) dans notre langage visuel. Le contenu reste celui de Steam (tout fonctionne) ;
// seules les classes stables de Steam sont ciblées (PagedSettingsDialog_*, Field, Toggle, DialogButton…).
// Les écrans natifs sont dessinés à l'échelle de la fenêtre (1280 px de large) : tailles = 2/3 des pixels de référence (1920 px) de nos écrans.
import { useEffect } from 'react';
import { findClassModule } from 'millennium';
import { usePath } from '../core/history';
import { useArt } from '../core/art';
import { getSettings, onSettings, useSettings } from '../core/settings';
import { tokens } from '../core/theme';
import { appById, bpRouter, bpWindow, heroUrl } from '../core/steam';

const w = window as any;

/** Nos boutons (classes spbp-…) gardent leurs propres règles. */
const NOT_OURS = ':not([class*="spbp-"])';

const BP_CSS = `
/* Police et couleurs de fond des écrans natifs */
.GamepadPage,.BasicFooter,.Header.GamepadMode,.GamepadDialogContent,.ModalPosition,.gamepaddialog_ModalPosition,.PagedSettingsDialog{font-family:var(--sp-font) !important;}
.BasicHome.OpaqueBackground,.GamepadPage.DialogBackground{background:var(--sp-bg) !important;}
.GamepadPage .DialogBackground,.PagedSettingsDialog_PageListColumn{background:var(--sp-bg) !important;}
.PagedSettingsDialog,.PagedSettingDialog_ContentColumn,.PagedSettingsDialog_PageContent{background:transparent !important;}

/* En-tête natif (recherche, réseau, heure, avatar) sur les écrans natifs */
.Header.GamepadMode{background:transparent !important;}
.Header.GamepadMode .HeaderItem.Clock{font-family:var(--sp-font) !important;font-weight:800 !important;font-variant-numeric:tabular-nums;}
.Header.GamepadMode .SearchFieldBackground{background:var(--sp-surface2) !important;border-radius:14px !important;}

/* Rail des pages (Paramètres, Propriétés) */
.PagedSettingsDialog_PageListColumn{border-right:1px solid var(--sp-line) !important;padding-left:20px !important;padding-right:14px !important;}
.PagedSettingsDialog_PageListItem{border:0 !important;border-radius:12px !important;margin:2px 0 !important;color:var(--sp-muted) !important;font-weight:600 !important;background:transparent !important;outline:2px solid transparent;outline-offset:2px;transition:outline-color .12s,box-shadow .12s;}
.PagedSettingsDialog_PageListItem .PageListItem_Title{font-family:var(--sp-font) !important;font-size:15px !important;}
.PagedSettingsDialog_PageListItem .PageListItem_Icon svg{opacity:.85;}
.PagedSettingsDialog_PageListItem.Active{background:var(--sp-surface2) !important;color:var(--sp-text) !important;font-weight:800 !important;}
.PagedSettingsDialog_PageListItem.Active::before,.PagedSettingsDialog_PageListItem.Active::after{display:none !important;}
.PagedSettingsDialog_PageListItem.gpfocus{outline-color:var(--sp-accent);box-shadow:var(--spbp-native-glow);color:var(--sp-text) !important;}
.PagedSettingsDialog_PageList .Separator{background:var(--sp-line) !important;margin:8px 14px !important;}
.PagedSettingsDialog_PageListColumn .PagedSettingsDialog_Title,.PagedSettingsDialog_PageListColumn > div:first-child:not(.PagedSettingsDialog_PageList){font-family:var(--sp-font) !important;font-weight:800 !important;}

/* Contenu : titre de page, sous-titres, champs en cartes */
.PagedSettingsDialog_PageContent .DialogHeader,.GamepadPage .DialogHeader{font-family:var(--sp-font) !important;font-size:30px !important;font-weight:800 !important;text-transform:none !important;letter-spacing:0 !important;color:var(--sp-text) !important;}
.DialogControlsSection{margin-top:6px !important;}
.SettingsDialogSubHeader{font-family:var(--sp-font) !important;font-size:11px !important;font-weight:800 !important;letter-spacing:.1em !important;text-transform:uppercase !important;color:var(--sp-muted) !important;margin:18px 0 8px 4px !important;}
.GamepadPage .Field.Background,.ModalPosition .Field.Background{background:var(--spbp-native-card) !important;border:1px solid var(--sp-line) !important;border-radius:17px !important;margin:0 0 8px !important;padding-left:20px !important;padding-right:20px !important;outline:2px solid transparent;outline-offset:2px;transition:outline-color .12s,box-shadow .12s;}
.GamepadPage .Field::after,.GamepadPage .Field.WithBottomSeparatorStandard::after{display:none !important;}
.GamepadPage .Field.Background.gpfocus,.GamepadPage .Field.Background:has(.gpfocus),.ModalPosition .Field.Background:has(.gpfocus){background:var(--sp-surface2) !important;outline:2px solid var(--sp-accent) !important;box-shadow:var(--spbp-native-glow) !important;}
.Field .FieldLabel{font-family:var(--sp-font) !important;font-weight:700 !important;color:var(--sp-text) !important;}
.Field .FieldDescription{font-family:var(--sp-font) !important;color:var(--sp-muted) !important;}
.Field .LabelFieldValue{color:var(--sp-muted) !important;}

/* Interrupteurs : rail d'accent quand activé, pastille sombre */
.Toggle .ToggleRail{background:var(--sp-surface2) !important;border:1.5px solid var(--sp-line) !important;box-sizing:border-box;}
.Toggle .ToggleSwitch{background:var(--sp-muted) !important;box-shadow:none !important;}
.Toggle.On .ToggleRail{background:var(--sp-accent) !important;border-color:var(--sp-accent) !important;}
.Toggle .ToggleRail::before{background:var(--sp-accent) !important;}
.Toggle.On .ToggleSwitch{background:var(--sp-accent-ink) !important;}

/* Boutons et listes déroulantes de Steam (hors nos propres boutons) */
.GamepadPage .DialogButton${NOT_OURS},.ModalPosition .DialogButton${NOT_OURS},.gamepaddialog_ModalPosition .DialogButton${NOT_OURS}{background:var(--sp-surface2) !important;color:var(--sp-text) !important;border:1.5px solid var(--sp-line) !important;border-radius:13px !important;font-family:var(--sp-font) !important;font-weight:700 !important;box-shadow:none !important;}
.GamepadPage .DialogButton${NOT_OURS}.gpfocus,.ModalPosition .DialogButton${NOT_OURS}.gpfocus,.gamepaddialog_ModalPosition .DialogButton${NOT_OURS}.gpfocus{background:var(--sp-text) !important;color:var(--sp-bg) !important;border-color:var(--sp-text) !important;box-shadow:var(--spbp-native-glow) !important;}
.DialogButton.Primary${NOT_OURS}{background:var(--sp-accent) !important;border-color:var(--sp-accent) !important;color:var(--sp-accent-ink) !important;}
.DropDownControlButton${NOT_OURS}{border-radius:12px !important;}
.GamepadPage input.DialogInput,.GamepadPage .DialogInput,.ModalPosition .DialogInput{background:var(--sp-surface2) !important;border:1.5px solid var(--sp-line) !important;border-radius:12px !important;color:var(--sp-text) !important;font-family:var(--sp-font) !important;}
.GamepadPage .DialogInput.gpfocus,.GamepadPage .DialogInput:focus{border-color:var(--sp-accent) !important;}
.GamepadPage a,.GamepadPage .Link,.GamepadPage [class*="Link"],.GamepadPage .DialogLink{color:var(--sp-accent) !important;}
.SliderControl .SliderTrack,.SliderTrack{background:var(--sp-surface2) !important;}
.SliderHandle{background:var(--sp-text) !important;}
.SliderTrackDark,.SliderControl .SliderTrack.SliderHasNotches{border-radius:6px !important;}

/* Dialogues (confirmations, choix, saisie) */
.ModalPosition .DialogContent,.gamepaddialog_ModalPosition .DialogContent,.ModalPosition .GenericConfirmDialog{background:var(--spbp-native-card) !important;border:1px solid var(--sp-line) !important;border-radius:24px !important;box-shadow:0 30px 80px rgba(0,0,0,.65) !important;}
.ModalPosition .DialogHeader,.gamepaddialog_ModalPosition .DialogHeader{font-family:var(--sp-font) !important;font-weight:800 !important;text-transform:none !important;letter-spacing:0 !important;color:var(--sp-text) !important;}
.ModalPosition .DialogBodyText,.ModalPosition .DialogBody{font-family:var(--sp-font) !important;color:var(--sp-muted) !important;}
.ModalOverlayContent.ModalOverlayBackground,.ModalOverlayBackground{background:rgba(0,0,0,.7) !important;}

/* Menus manette (options d'un jeu, listes déroulantes ouvertes) */
.gamepadcontextmenu_ContextMenuContainer,[class*="ContextMenuContainer"]{font-family:var(--sp-font) !important;}
.MenuItem${NOT_OURS},.gamepadcontextmenu_contextMenuItem,[class*="contextMenuItem"]{font-family:var(--sp-font) !important;border-radius:12px !important;}
/* ces menus défilent (leur liste coupe ce qui dépasse) : contour et halo à l'intérieur de l'entrée */
[class*="contextMenuItem"].gpfocus,[class*="contextMenuItem"]:focus{background:var(--sp-surface2) !important;color:var(--sp-text) !important;outline:2px solid var(--sp-accent);outline-offset:-2px;box-shadow:var(--spbp-native-glow-in);}
.DropDownMenu,.gamepaddropdown_DropDownMenu{font-family:var(--sp-font) !important;}
.BasicContextMenuHeader{font-family:var(--sp-font) !important;font-weight:800 !important;}
.BasicContextMenuContainer{background:var(--spbp-native-card) !important;border:1px solid var(--sp-line) !important;border-radius:20px !important;padding:6px !important;box-shadow:0 24px 70px rgba(0,0,0,.6) !important;}
.BasicContextMenuContainer [class*="contextMenuItem"]{font-family:var(--sp-font) !important;font-weight:600 !important;}

/* Paramètres : titre au-dessus du rail ; Propriétés : bannière du jeu atténuée en fond */
[data-spbp-route="settings"] .PagedSettingsDialog_PageList::before{content:"Paramètres";display:block;font-family:var(--sp-font);font-size:27px;font-weight:800;color:var(--sp-text);padding:4px 14px 18px;}
[data-spbp-route="properties"] .GamepadPage.DialogBackground{background:linear-gradient(to bottom,color-mix(in srgb,var(--sp-bg) 30%,transparent) 0,color-mix(in srgb,var(--sp-bg) 75%,transparent) 90px,var(--sp-bg) 150px),var(--spbp-hero,none) center top / 100% auto no-repeat,var(--sp-bg) !important;}
[data-spbp-route="properties"] .PagedSettingsDialog_PageListColumn,[data-spbp-route="properties"] .GamepadPage .DialogBackground{background:transparent !important;}

/* Squircle partout où il y a des coins arrondis */
.spbp-squircle .GamepadPage *,.spbp-squircle .ModalPosition *,.spbp-squircle [class*="ContextMenuContainer"] *{corner-shape:squircle;}
.spbp-squircle .Toggle,.spbp-squircle .Toggle *{corner-shape:round !important;}
`;

/**
 * Clavier virtuel : nos couleurs à la place du thème de clavier choisi
 * dans Steam. Les états (focus, appui, Maj active, libellés secondaires) n'ont que des classes hachées : on les lit
 * dans la table de classes du clavier, qui suit les mises à jour de Steam.
 */
let kbClasses: any;

function keyboardCss(): string {
	kbClasses ||= findClassModule((c: any) => c.Keyboard && c.KeyboardKey && c.KeyboardKeyHitArea);
	const m: any = kbClasses || {};
	const cls = (k: string) => (m[k] ? `.${m[k]}` : '');
	const key = '.VirtualKeyboardContainer .Keyboard .KeyboardKey';
	const hit = (keys: string[]) => keys.map((k) => `.VirtualKeyboardContainer [data-key${k.endsWith('*') ? `^="${k.slice(0, -1)}"` : `="${k}"`}] > .KeyboardKey`).join(',');
	const special = hit(['Tab', 'CapsLock', 'Shift', 'Backspace', 'AltGr', 'VKPaste', 'VKClose', 'Arrow*', 'SwitchKeys_*']);
	const enter = hit(['Enter']);
	const focus = [`.VirtualKeyboardContainer .KeyboardKeyHitArea.gpfocus > .KeyboardKey`, cls('Focused') && `${key}${cls('Focused')}`].filter(Boolean).join(',');
	const touched = cls('Touched') ? `${key}${cls('Touched')}` : '';
	// Maj : ToggleOneShot pour une lettre, ToggleOn une fois verrouillée
	const toggled = ['ToggleOn', 'ToggleOneShot'].filter((k) => m[k]).map((k) => `${key}${cls(k)}`).join(',');
	const labels = [cls('ShiftedLabel'), cls('AltGrLabel'), cls('InactiveLabel')].filter(Boolean).map((c) => `${key} ${c}`).join(',');
	return `
/* fond et filet du haut sur toute la largeur de l'écran */
.VirtualKeyboardContainer{background:var(--spbp-kb) !important;border-top:1px solid var(--sp-line) !important;box-sizing:border-box;}
.VirtualKeyboardContainer .Keyboard{background:transparent !important;border:0 !important;box-shadow:none !important;font-family:var(--sp-font) !important;}
/* glyphes de la manette : le thème de clavier les assombrit pour des touches claires */
.VirtualKeyboardContainer .ActionButtonGlyph img{filter:none !important;opacity:.85;}
.VirtualKeyboardContainer [data-key="Enter"] .ActionButtonGlyph img{filter:invert(1) !important;opacity:.8;}
${key},${key}.KeyboardKeyDeadKey{background:var(--sp-bg) !important;background-image:none !important;color:var(--sp-text) !important;border:1px solid var(--sp-line) !important;border-radius:13px !important;box-shadow:none !important;text-shadow:none !important;font-family:var(--sp-font) !important;font-weight:700 !important;transition:outline-color .12s,box-shadow .12s;}
${key}::before,${key}::after{display:none !important;}
${special}{background:var(--sp-surface2) !important;}
${enter}{background:var(--sp-accent) !important;border-color:var(--sp-accent) !important;color:var(--sp-accent-ink) !important;}
${labels ? `${labels}{color:var(--sp-muted) !important;}` : ''}
${toggled ? `${toggled}{color:var(--sp-accent) !important;border-color:var(--sp-accent) !important;}` : ''}
/* touche focalisée au-dessus de ses voisines : son contour et son halo ne passent pas dessous */
.VirtualKeyboardContainer .KeyboardKeyHitArea.gpfocus{z-index:3 !important;}
${focus}{background:var(--sp-surface2) !important;color:var(--sp-text) !important;outline:2px solid var(--sp-accent) !important;outline-offset:2px !important;box-shadow:var(--spbp-native-glow) !important;}
${hit(['Enter']).replace(/\] > /g, '].gpfocus > ')}{background:var(--sp-accent) !important;color:var(--sp-accent-ink) !important;outline-color:var(--sp-text) !important;}
${touched ? `${touched}{background:color-mix(in srgb,var(--sp-accent) 35%,var(--sp-surface2)) !important;}` : ''}
`;
}

/** Feuille propre aux fenêtres annexes (menu Steam, accès rapide, notifications). */
const POPUP_CSS = `
body,.BasicUI,body *:not(svg):not(path):not(g){font-family:var(--sp-font) !important;}
/* Menu Steam (touche Steam / PS) */
.Menu.Panel,[class*="MainMenu"] .Menu{background:var(--sp-bg) !important;border-right:1px solid var(--sp-line) !important;}
.Container > .Menu,.BasicUI.Container{background:var(--sp-bg) !important;}
/* le halo de l'entrée focalisée dépasse de son conteneur (coupé sinon en haut, en bas et contre le bord de la fenêtre) */
.ItemOuter{box-sizing:border-box !important;width:100% !important;padding:0 16px 0 12px !important;overflow:visible !important;}
/* la fenêtre du menu est étroite (240 px à l'échelle) : pastille presque pleine largeur, marge intérieure réduite,
   pour que les libellés longs (« Téléchargements », « Contacts et chat ») tiennent sans défiler */
.ItemOuter > .Item.Panel{box-sizing:border-box !important;width:calc(100% - 8px) !important;padding-left:14px !important;padding-right:10px !important;}
/* pastille de la section courante : à l'accent */
.Item .ActiveDot{background:var(--sp-accent) !important;border-radius:50% !important;width:8px !important;height:8px !important;corner-shape:round !important;}
.Item.Panel{border-radius:15px !important;color:var(--sp-muted) !important;font-family:var(--sp-font) !important;font-weight:600 !important;background:transparent !important;outline:2px solid transparent;outline-offset:2px;transition:outline-color .12s,box-shadow .12s;}
.Item.Panel .ItemLabel{font-family:var(--sp-font) !important;}
/* Steam agrandit l'entrée focalisée de 10 % (depuis la gauche) : un libellé long sortait de sa pastille ;
   agrandissement léger et graisse presque constante */
.Item.Panel.gpfocus{transform:scale(1.04) !important;background:var(--sp-surface2) !important;color:var(--sp-text) !important;font-weight:700 !important;outline:2px solid var(--sp-accent) !important;outline-offset:-2px !important;box-shadow:var(--spbp-native-glow);}
.Item.Panel.Selected,.Item.Panel.Active{color:var(--sp-text) !important;}
[data-spbp-hidden]{display:none !important;}
.FooterBoxShadow{display:none !important;}
.spbp-menu-head{display:flex;align-items:center;gap:12px;padding:30px 24px 18px 26px;color:var(--sp-text);font-family:var(--sp-font);}
.spbp-menu-head img,.spbp-menu-head .spbp-menu-ini{width:46px;height:46px;border-radius:50%;object-fit:cover;background:var(--sp-accent);color:var(--sp-accent-ink);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:20px;corner-shape:round !important;}
.spbp-menu-head b{display:block;font-size:19px;font-weight:800;}
.spbp-menu-head small{display:block;font-size:13px;color:var(--sp-muted);}
.spbp-menu-head time{margin-left:auto;font-size:18px;font-weight:800;font-variant-numeric:tabular-nums;}
/* Accès rapide : onglets, titre, notifications en cartes (même gabarit que les notifications qui s'affichent en haut) */
.QuickAccessMenu .Title,.QuickAccessMenu .HeaderContainer{background:var(--sp-bg) !important;font-weight:800 !important;box-shadow:none !important;}
.QuickAccessMenu .TabList .Tab{border-radius:16px !important;color:var(--sp-muted) !important;}
.QuickAccessMenu .TabList .Tab.Selected{background:var(--sp-surface2) !important;color:var(--sp-text) !important;}
/* listes serrées contre le bord ou dans une colonne qui coupe ce qui dépasse : halo intérieur, jamais coupé */
.QuickAccessMenu .TabList .Tab.gpfocus{outline:2px solid var(--sp-accent) !important;outline-offset:-2px;box-shadow:var(--spbp-native-glow-in);}
.SteamNotificationWrapper{border:0 !important;padding:0 !important;margin:0 0 8px !important;}
.SteamNotificationWrapper::after,.SteamNotificationWrapper::before{display:none !important;}
.StandardTemplateContainer{background:var(--spbp-native-card) !important;border:1px solid var(--sp-line) !important;border-radius:16px !important;padding:10px 12px !important;outline:2px solid transparent;outline-offset:2px;transition:outline-color .12s,box-shadow .12s;}
.StandardTemplateContainer.gpfocus{background:var(--sp-surface2) !important;outline:2px solid var(--sp-accent) !important;outline-offset:-2px !important;box-shadow:var(--spbp-native-glow-in);}
.StandardTemplate .StandardLogoDimensions img{border-radius:10px !important;}
.StandardTemplate .Header .Title{color:var(--sp-accent) !important;font-size:13px !important;font-weight:800 !important;background:none !important;}
.StandardTemplate .Header .Icon svg{color:var(--sp-accent) !important;fill:currentColor;}
.StandardTemplate .Header .Timestamp{color:var(--sp-muted) !important;}
.StandardNotificationDescription{color:var(--sp-text) !important;font-weight:700 !important;}
.StandardNotificationSubText{color:var(--sp-muted) !important;}
.StandardNotificationSubText span{color:var(--sp-text) !important;font-weight:700 !important;}
/* Accès rapide › Contacts : liste sur fond du thème, noms alignés à gauche, focus d'accent */
.friendlist.GamepadMode,.FriendsListContent,.multiChatDialog.GamepadMode{background:var(--sp-bg) !important;}
.FriendListInsetShadowTop,.FriendListInsetShadowBottom{display:none !important;}
.TabPanelHeader{font-weight:800 !important;color:var(--sp-text) !important;}
.FriendsListTab.Active{background:var(--sp-surface2) !important;border-radius:12px !important;}
.quickAccessFriend.friend{border-radius:12px !important;outline:2px solid transparent;outline-offset:-2px;}
.quickAccessFriend.friend.gpfocus{background:var(--sp-surface2) !important;outline:2px solid var(--sp-accent) !important;outline-offset:-2px !important;box-shadow:var(--spbp-native-glow-in);}
/* onglet Favoris : le focus est sur l'enveloppe du contact */
.favoriteElement{border-radius:12px !important;outline:2px solid transparent;outline-offset:-2px;}
.favoriteElement.gpfocus{background:var(--sp-surface2) !important;outline:2px solid var(--sp-accent) !important;outline-offset:-2px !important;box-shadow:var(--spbp-native-glow-in);}
.quickAccessFriend .labelHolder,.quickAccessFriend .labelHolder *{text-align:left !important;}
.quickAccessFriend .statusAndName .playerName{margin-left:0 !important;margin-right:auto !important;}
.emptyChatDialogs{color:var(--sp-muted) !important;font-weight:700 !important;letter-spacing:.06em;}
/* Accès rapide : le reste */
.QuickAccessMenu,[class*="QuickAccessMenu"],[class*="QuickAccess"] .TabContentColumn,.ViewPlaceholder{font-family:var(--sp-font) !important;}
[class*="QuickAccessMenu"]{background:var(--sp-bg) !important;}
[class*="Tabs"] [class*="Tab"].gpfocus,[class*="TabsColumn"] .gpfocus{outline:2px solid var(--sp-accent);outline-offset:-2px;box-shadow:var(--spbp-native-glow-in);border-radius:16px !important;}
.Field.Background{background:var(--spbp-native-card) !important;border:1px solid var(--sp-line) !important;border-radius:14px !important;}
.Field.Background.gpfocus,.Field.Background:has(.gpfocus){background:var(--sp-surface2) !important;outline:2px solid var(--sp-accent);outline-offset:-2px;box-shadow:var(--spbp-native-glow-in);}
.Toggle .ToggleRail{background:var(--sp-surface2) !important;}
.Toggle.On .ToggleRail{background:var(--sp-accent) !important;}
.Toggle .ToggleRail::before{background:var(--sp-accent) !important;}
.Toggle.On .ToggleSwitch{background:var(--sp-accent-ink) !important;}
.DialogButton{border-radius:12px !important;font-family:var(--sp-font) !important;}
.DialogButton.gpfocus{background:var(--sp-text) !important;color:var(--sp-bg) !important;}
`;

/** Variables du thème Big Picture (OLED par défaut) et réglages de l'habillage. */
function vars(): string {
	const s = getSettings();
	const t = tokens({ ...s, theme: s.bpTheme } as any);
	const oled = s.bpTheme === 'oled';
	const accent = t['--sp-accent'];
	const extra: Record<string, string> = {
		'--spbp-native-card': oled ? '#07080a' : t['--sp-surface'],
		'--spbp-native-glow': oled ? `0 0 26px ${accent}66` : '0 8px 20px rgba(0,0,0,.45)',
		'--spbp-native-glow-in': oled ? `inset 0 0 18px ${accent}55` : 'none',
		'--spbp-kb': oled ? '#050607' : t['--sp-surface'],
	};
	return `:root{${Object.entries({ ...t, ...extra })
		.map(([k, v]) => `${k}:${v};`)
		.join('')}}`;
}

function ensureStyle(doc: Document | undefined, id: string, css: string) {
	if (!doc?.head) return;
	let el = doc.getElementById(id) as HTMLStyleElement | null;
	if (!el) {
		el = doc.createElement('style');
		el.id = id;
		doc.head.appendChild(el);
	}
	if (el.textContent !== css) el.textContent = css;
	if (!doc.getElementById('spbp-font')) {
		const font = doc.createElement('link');
		font.id = 'spbp-font';
		font.rel = 'stylesheet';
		font.href = 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap';
		doc.head.appendChild(font);
	}
}

/** Fenêtres annexes de Big Picture (menu Steam, accès rapide, notifications) : absentes de g_PopupManager,
 * on les retrouve par les sources d'entrée manette de Steam. */
function sideWindows(): Window[] {
	const ctx = bpRouter()?.m_FocusNavContext;
	const main = bpWindow();
	const out = new Set<Window>();
	for (const src of ctx?.m_controller?.m_rgGamepadInputSources || []) if (src?.m_targetWindow && src.m_targetWindow !== main) out.add(src.m_targetWindow);
	for (const tree of ctx?.m_rgGamepadNavigationTrees || []) if (tree?.m_window && tree.m_window !== main) out.add(tree.m_window);
	return [...out].filter((x) => {
		try {
			return !!x.document?.head;
		} catch {
			return false;
		}
	});
}

const PRESENCE_LABEL: Record<number, string> = { 0: 'Hors ligne', 1: 'En ligne', 2: 'Ne pas déranger', 3: 'Absence', 7: 'Invisible' };

/** Menu Steam : « Console » retirée, en-tête avec le compte, la présence et l'heure. */
function dressMainMenu(doc: Document) {
	const items = Array.from(doc.querySelectorAll('.ItemOuter')) as HTMLElement[];
	if (!items.length) return;
	// « Console » reconnue par sa traduction dans la langue de Steam ; masquée par un attribut (React réécrit la classe)
	const consoleLabel = String(w.LocalizationManager?.m_mapTokens?.get('Menu_Console') || 'Console').trim();
	for (const it of items) {
		const label = it.querySelector('.ItemLabel')?.textContent?.trim();
		if (label === consoleLabel) it.dataset.spbpHidden = '';
		else delete it.dataset.spbpHidden;
	}
	const menu = items[0].parentElement;
	if (!menu) return;
	let head = doc.querySelector('.spbp-menu-head') as HTMLElement | null;
	if (!head) {
		head = doc.createElement('div');
		head.className = 'spbp-menu-head';
		head.setAttribute('aria-hidden', 'true');
		menu.insertBefore(head, menu.firstChild);
	}
	const ui = w.friendStore?.m_FriendsUIFriendStore;
	const name = ui?.m_self?.m_persona?.m_strPlayerName || '';
	const hash = ui?.m_self?.m_persona?.m_strAvatarHash;
	const avatar = hash && !/^0+$/.test(hash) ? `https://avatars.steamstatic.com/${hash}_medium.jpg` : '';
	const presence = PRESENCE_LABEL[Number(ui?.m_eUserPersonaState ?? 1)] || '';
	const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
	const sig = `${name}|${avatar}|${presence}|${time}`;
	if (head.dataset.sig === sig) return;
	head.dataset.sig = sig;
	head.textContent = '';
	if (avatar) {
		const img = doc.createElement('img');
		img.src = avatar;
		img.alt = '';
		head.appendChild(img);
	} else {
		const ini = doc.createElement('span');
		ini.className = 'spbp-menu-ini';
		ini.textContent = name.charAt(0).toUpperCase();
		head.appendChild(ini);
	}
	const who = doc.createElement('span');
	const b = doc.createElement('b');
	b.textContent = name;
	const small = doc.createElement('small');
	small.textContent = presence;
	who.append(b, small);
	const t = doc.createElement('time');
	t.textContent = time;
	head.append(who, t);
}

/** Pictogrammes du menu Marche/arrêt (tracés 24×24, posés en masque pour prendre la couleur du texte). */
const POWER_ICONS: Record<string, string> = {
	exit: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
	minimize: 'M3 4h18v12H3zM8 20h8M12 16v4',
	restart: 'M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5',
	quit: 'M18 6 6 18M6 6l12 12',
	account: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
	sleep: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
	power: 'M12 2v10M18.4 6.6a9 9 0 1 1-12.8 0',
	controller: 'M6 11h4M8 9v4M15 12h.01M18 10h.01M17.3 5H6.7a4 4 0 0 0-3.9 3.2l-1.1 5.6A3 3 0 0 0 4.6 17.3c.9 0 1.7-.4 2.3-1L9 14h6l2.1 2.3c.6.6 1.4 1 2.3 1a3 3 0 0 0 2.9-3.5l-1.1-5.6A4 4 0 0 0 17.3 5z',
	logout: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l-5-5 5-5M5 12h12',
	cancel: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-1',
};

/** Entrées connues du menu Marche/arrêt : clé de traduction de Steam → pictogramme. */
const POWER_ITEMS: [string, string][] = [
	['PowerChordMenu_Suspend', 'sleep'],
	['PowerChordMenu_Sleep', 'sleep'],
	['Quit_Shutdown', 'power'],
	['PowerChordMenu_Shutdown', 'power'],
	['Quit_Restart', 'restart'],
	['RestartDevice', 'restart'],
	['PowerChordMenu_TurnOffController', 'controller'],
	['ConnectionTrouble_LoginChanged_Reload', 'account'],
	['Menu_LogOut', 'logout'],
	['MinimizeSteam', 'minimize'],
	['ExitGamepadUI', 'exit'],
	['TaskbarOption_CloseBigPicture', 'exit'],
	['RestartSteam', 'restart'],
	['ExitSteam', 'quit'],
	['Button_Cancel', 'cancel'],
];

const iconMask = (d: string) =>
	`url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`)}")`;

const POWER_CSS = `
/* Menu Marche/arrêt : panneau arrondi, entrées avec pictogramme, séparateurs entre les types d'action */
[data-spbp-power]{background:var(--spbp-native-card) !important;border:1px solid var(--sp-line) !important;border-radius:24px !important;padding:10px !important;min-width:340px !important;box-shadow:0 30px 80px rgba(0,0,0,.7) !important;}
/* menu court : rien à faire défiler, le halo du focus peut dépasser */
[data-spbp-power],[data-spbp-power] > *{overflow:visible !important;}
[data-spbp-power] .BasicContextMenuHeader{font-family:var(--sp-font) !important;font-size:20px !important;font-weight:800 !important;text-transform:none !important;letter-spacing:0 !important;color:var(--sp-text) !important;padding:8px 14px 12px !important;}
[data-spbp-power] .ContextMenuSeparator{display:none !important;}
[data-spbp-power] .contextMenuItem{position:relative !important;display:flex !important;align-items:center !important;min-height:48px !important;margin:2px 0 !important;padding:0 18px 0 52px !important;border-radius:14px !important;background:transparent !important;color:var(--sp-text) !important;font-family:var(--sp-font) !important;font-size:16px !important;font-weight:700 !important;text-transform:none !important;outline:2px solid transparent;outline-offset:-2px;transition:outline-color .12s,box-shadow .12s,background .12s;}
[data-spbp-power] .contextMenuItem::after{content:"";position:absolute;left:18px;top:50%;width:20px;height:20px;margin-top:-10px;background:var(--sp-muted);-webkit-mask:var(--spbp-icon) center/contain no-repeat;mask:var(--spbp-icon) center/contain no-repeat;}
[data-spbp-power] .contextMenuItem.gpfocus,[data-spbp-power] .contextMenuItem:focus{background:var(--sp-surface2) !important;outline-color:var(--sp-accent) !important;box-shadow:var(--spbp-native-glow) !important;}
[data-spbp-power] .contextMenuItem.gpfocus::after,[data-spbp-power] .contextMenuItem:focus::after{background:var(--sp-accent);}
[data-spbp-power] .contextMenuItem[data-spbp-icon="cancel"]{color:var(--sp-muted) !important;}
[data-spbp-power] .contextMenuItem[data-spbp-group-start]{margin-top:17px !important;}
[data-spbp-power] .contextMenuItem[data-spbp-group-start]::before{content:"";position:absolute;left:14px;right:14px;top:-10px;height:1px;background:var(--sp-line);}
${Object.entries(POWER_ICONS)
	.map(([k, d]) => `[data-spbp-power] .contextMenuItem[data-spbp-icon="${k}"]{--spbp-icon:${iconMask(d)};}`)
	.join('\n')}
`;

/**
 * Repère le menu Marche/arrêt (il contient « Quitter le mode Big Picture ») et marque ses entrées. Les groupes sont
 * ceux de Steam (système, compte, Steam, Annuler), délimités par ses séparateurs, que l'on remplace par un filet net.
 */
function dressPowerMenu(doc: Document) {
	const tokens: Map<string, string> | undefined = w.LocalizationManager?.m_mapTokens;
	if (!tokens) return;
	const icons = new Map<string, string>();
	for (const [tok, icon] of POWER_ITEMS) {
		const label = tokens.get(tok);
		if (label && !icons.has(label.trim())) icons.set(label.trim(), icon);
	}
	// version manette (au centre) et version souris (près du curseur)
	for (const box of Array.from(doc.querySelectorAll('.BasicContextMenuContainer, .contextMenuContents')) as HTMLElement[]) {
		const entries = Array.from(box.querySelectorAll('.contextMenuItem, .ContextMenuSeparator')) as HTMLElement[];
		const label = (el: HTMLElement) => el.textContent?.trim() || '';
		if (!entries.some((el) => icons.get(label(el)) === 'exit') || box.parentElement?.closest('[data-spbp-power]')) continue;
		box.dataset.spbpPower = '';
		let afterSeparator = false;
		for (const el of entries) {
			if (el.classList.contains('ContextMenuSeparator')) {
				afterSeparator = true;
				continue;
			}
			const icon = icons.get(label(el));
			if (icon) el.dataset.spbpIcon = icon;
			else delete el.dataset.spbpIcon;
			if (afterSeparator) el.dataset.spbpGroupStart = '';
			else delete el.dataset.spbpGroupStart;
			afterSeparator = false;
		}
	}
}

/** Habille le menu Marche/arrêt dès qu'il apparaît (avant qu'il soit dessiné), dans toutes les fenêtres de Big Picture. */
const watched = new WeakSet<Document>();
function watchPowerMenu(doc: Document) {
	if (watched.has(doc) || !doc.body) return;
	watched.add(doc);
	const Observer = (doc.defaultView as any)?.MutationObserver || MutationObserver;
	new Observer(() => {
		if (doc.querySelector('.BasicContextMenuContainer:not([data-spbp-power]), .contextMenuContents:not([data-spbp-power])')) dressPowerMenu(doc);
	}).observe(doc.body, { childList: true, subtree: true });
}

let kbCss: string | undefined;

function paint() {
	const main = bpWindow();
	if (!main) return;
	const s = getSettings();
	const v = vars();
	if (!kbCss || !kbClasses) kbCss = keyboardCss();
	ensureStyle(main.document, 'spbp-native', v + BP_CSS + kbCss + POWER_CSS);
	main.document.documentElement.classList.toggle('spbp-squircle', s.forme === 'squircle');
	watchPowerMenu(main.document);
	for (const win of sideWindows()) {
		try {
			ensureStyle(win.document, 'spbp-native', v + POPUP_CSS + POWER_CSS);
			watchPowerMenu(win.document);
			win.document.documentElement.classList.toggle('spbp-squircle', s.forme === 'squircle');
			if (win.document.querySelector('.ItemOuter .ItemLabel')) dressMainMenu(win.document);
		} catch {}
	}
}

let started = false;

/** À appeler une fois : repeint tant que Big Picture est ouvert (ses fenêtres annexes sont recréées par Steam). */
export function initBpNativeSkin() {
	if (started) return;
	started = true;
	setInterval(() => {
		try {
			paint();
		} catch {}
	}, 1000);
	onSettings(() => paint());
}

/** Composant global de Big Picture : bannière du jeu en fond des Propriétés, route courante pour la feuille. */
export function BpNativeSkin(): null {
	useSettings();
	const path = usePath('bp');
	const appid = Number(path.match(/^\/app\/(\d+)\/properties/)?.[1] || 0);
	const app = appid ? appById(appid) : null;
	const hero = useArt(app, 'hero', app ? heroUrl(app) : '');
	useEffect(() => {
		const root = bpWindow()?.document?.documentElement;
		if (!root) return;
		root.dataset.spbpRoute = path.startsWith('/settings') ? 'settings' : appid ? 'properties' : '';
		if (appid && hero) root.style.setProperty('--spbp-hero', `url("${hero}")`);
		else root.style.removeProperty('--spbp-hero');
	}, [path, appid, hero]);
	return null;
}
