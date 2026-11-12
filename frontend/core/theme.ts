import type { Settings } from './settings';

export const ACCENTS: Record<string, { label: string; hex: string }> = {
	bleu: { label: 'Bleu', hex: '#5aa9ff' },
	cyan: { label: 'Cyan', hex: '#3fd0e0' },
	vert: { label: 'Vert', hex: '#4fd18b' },
	jaune: { label: 'Jaune', hex: '#f2c14e' },
	orange: { label: 'Orange', hex: '#ff8a3d' },
	rose: { label: 'Rose', hex: '#ff7ab0' },
	violet: { label: 'Violet', hex: '#b48cff' },
	rouge: { label: 'Rouge', hex: '#ff6b6b' },
};

// [fond, surface, surface 2, contour] : luminosité volontairement très basse
export const FONDS: Record<string, { label: string; c: [string, string, string, string] }> = {
	nuit: { label: 'Nuit', c: ['#10151d', '#161d27', '#202a37', '#2a3544'] },
	graphite: { label: 'Graphite', c: ['#121314', '#1a1b1d', '#25272a', '#303236'] },
	aubergine: { label: 'Aubergine', c: ['#15111c', '#1d1726', '#282033', '#342a42'] },
	foret: { label: 'Forêt', c: ['#0f1613', '#151e1a', '#1f2a25', '#29362f'] },
	bordeaux: { label: 'Bordeaux', c: ['#1a0f12', '#231519', '#301d23', '#3d262d'] },
	moka: { label: 'Moka', c: ['#17120f', '#1f1915', '#2b231d', '#382d26'] },
};

// Couleurs des membres de la famille, dans l'ordre de découverte
export const MEMBER_COLORS = ['#f5b14c', '#c49bff', '#4fb3d1', '#e0694f', '#8bd16a', '#ff7ab0'];

function hexToRgb(hex: string): [number, number, number] {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function tokens(s: Settings): Record<string, string> {
	const accent = (ACCENTS[s.accent] || ACCENTS.bleu).hex;
	const f = (FONDS[s.fond] || FONDS.nuit).c;
	const oled = s.theme === 'oled';
	const sq = s.forme === 'squircle';
	return {
		'--sp-bg': oled ? '#000000' : f[0],
		'--sp-surface': oled ? (s.oledNoFill ? '#000000' : '#07080a') : f[1],
		// En OLED, gris neutres fixes : la teinte du fond ne s'applique pas
		'--sp-surface2': oled ? '#0f1013' : f[2],
		'--sp-line': oled ? '#1f2228' : f[3],
		'--sp-text': oled ? '#f2f4f7' : '#e8edf3',
		'--sp-muted': oled ? '#959ca8' : '#9aa7b6',
		'--sp-accent': accent,
		'--sp-accent-ink': '#0a0d12',
		'--sp-online': '#4fd18b',
		'--sp-away': '#e7b43c',
		'--sp-busy': '#e0694f',
		// Succès (notifications du bureau)
		'--sp-trophy': '#f2c14e',
		'--sp-deal': '#4fd18b',
		'--sp-deal-ink': '#06180d',
		'--sp-glow': s.oledHalo ? `0 0 28px ${accent}66` : 'none',
		'--sp-r-sm': sq ? '12px' : '6px',
		'--sp-r-md': sq ? '18px' : '10px',
		'--sp-r-lg': sq ? '26px' : '14px',
		'--sp-r-cover': sq ? '20px' : '10px',
		'--sp-font': "Manrope, 'Segoe UI', system-ui, sans-serif",
	};
}

export function buildCss(s: Settings): string {
	const t = tokens(s);
	const vars = Object.entries(t).map(([k, v]) => `${k}:${v};`).join('');
	const [r, g, b] = hexToRgb(t['--sp-accent']);
	const p3 = s.hdrWide
		? `@media (color-gamut: p3){:root{--sp-accent:color(display-p3 ${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)});}}`
		: '';
	const squircle = s.forme === 'squircle' ? `.sp-root,.sp-root *,.sp-topnav,.sp-topnav *,.sp-pop,.sp-pop *,.contextMenu,.contextMenuItem,.DownloadsPage .Section,.DownloadsPage .SectionItem,.DownloadsPage .DialogButton,.sp-steamset *,.DesktopUI .AppProperties *,.DesktopUI .GenericDialogBase,.DesktopUI .GenericDialogBase *,.DesktopUI .InstallRequestModal,.DesktopUI .InstallRequestModal *,.DesktopUI .EulaModalDialog,.DesktopUI .EulaModalDialog *,.DesktopToastContainer .Middle,.DesktopToastContainer .AppLogo *{corner-shape:squircle;}` : '';
	const hdrImages = s.hdrWide ? `.sp-root img{dynamic-range-limit:${s.hdrHalo ? 'no-limit' : 'constrained'};}` : '';
	return `
:root{${vars}}
${p3}
${squircle}
${hdrImages}
/* Habillage de Steam autour de nos pages */
.TitleBar,.SuperNavBar,.BottomBar,.BottomBarContainer{background:var(--sp-surface) !important;}
.TopBar{background:var(--sp-surface) !important;border-bottom:1px solid var(--sp-line);}
.ContentFrame{background:var(--sp-bg) !important;}
/* Une seule barre : menus Steam, notre navigation, puis les contrôles de Steam. La 2e rangée (SuperNavBar) disparaît. */
.TopBar > .SuperNavBar{display:none !important;}
.TopBar > .TitleBar{height:44px !important;min-height:44px !important;align-items:center;}
.TopBar > .TitleBar > .TitleBarControls{align-self:center;display:flex;align-items:center !important;height:auto !important;flex:none;margin:0 !important;}
/* La zone vide de la barre sert à déplacer la fenêtre : elle doit garder toute la hauteur */
.TopBar > .TitleBar > .DragArea{align-self:stretch !important;height:auto !important;flex:1 1 24px !important;min-width:24px;}
.TopBar > .TitleBar > .sp-nav-host{flex:0 1 auto;min-width:0;overflow:hidden;}
.TopBar > .TitleBar > .WindowControls{flex:none;}
/* Barre bleue de focus en haut de la fenêtre : à la couleur d'accent */
.FocusBar.Focused{background-image:linear-gradient(to right,transparent 10%,color-mix(in srgb,var(--sp-accent) 55%,transparent) 50%,transparent 90%) !important;}
.TopBar > .TitleBar > .TitleBarControls > *{display:flex;align-items:center;}
.TopBar > .TitleBar .GamepadUIToggle{display:flex !important;align-items:center;justify-content:center;}
.TopBar > .TitleBar > .WindowControls{align-self:stretch;height:44px !important;}
.TopBar > .TitleBar > .WindowControls .title-area{height:44px !important;display:flex;align-items:center;}
.TopBar > .TitleBar > .WindowControls .window-controls{height:100%;display:flex;align-items:center;}
/* Steam décale le bouton Steam (2 px) et le groupe de droite (5 px) vers le bas : tout est recentré dans la barre */
.TopBar > .TitleBar > .RootMenuBar{flex:none;margin:0 !important;height:44px !important;align-items:center;}
.sp-nav-host{display:flex;align-items:center;flex:none;height:100%;}
.sp-account-host{display:flex;align-items:center;-webkit-app-region:no-drag;}
.sp-native-account{display:none !important;}
.sp-dl-host{display:flex;align-items:center;margin-right:8px;-webkit-app-region:no-drag;}
.sp-dl{position:relative;display:flex;align-items:center;justify-content:center;gap:7px;min-width:34px;height:30px;padding:0 13px 0 11px;white-space:nowrap;font-variant-numeric:tabular-nums;border-radius:15px;border:1px solid var(--sp-line);background:var(--sp-surface2);color:var(--sp-text);font-family:var(--sp-font);font-weight:700;font-size:13px;cursor:pointer;overflow:hidden;-webkit-app-region:no-drag;corner-shape:round !important;}
.sp-dl:hover,.sp-dl[aria-current="page"]{border-color:var(--sp-accent);}
.sp-dl svg{color:var(--sp-muted);}
.sp-dl:hover svg,.sp-dl[aria-current="page"] svg,.sp-dl.sp-dl-active svg{color:var(--sp-accent);}
/* Flèche qui descend en boucle pendant un téléchargement (pas en pause) */
.sp-dl-moving .sp-dl-arrow{animation:sp-dl-drop 1.5s cubic-bezier(.45,0,.4,1) infinite;}
@keyframes sp-dl-drop{0%{transform:translateY(-9px);opacity:0;}30%{transform:translateY(0);opacity:1;}72%{transform:translateY(0);opacity:1;}100%{transform:translateY(5px);opacity:0;}}
@media (prefers-reduced-motion:reduce){.sp-dl-moving .sp-dl-arrow{animation:none;}}
.sp-dl-bar{position:absolute;left:8px;right:8px;bottom:3px;height:2px;border-radius:1px;background:var(--sp-line);}
.sp-dl-bar > i{display:block;height:100%;border-radius:1px;background:var(--sp-accent);}
.sp-dl svg{flex:none;}
.sp-dl-text{line-height:1;}
.sp-dl-active .sp-dl-text{color:var(--sp-text);}
/* Bulle du bouton Téléchargements (au survol) : téléchargement en cours et avancement */
.sp-pop.sp-dl-tip{width:280px;box-sizing:border-box;padding:12px 14px;display:flex;flex-direction:column;gap:6px;pointer-events:none;font-size:13px;animation:sp-dl-tip-in .14s ease-out;}
.sp-pop.sp-dl-tip--idle{width:auto;padding:10px 16px;text-align:center;align-items:center;}
.sp-dl-tip-name{font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sp-dl-tip-row{display:flex;align-items:center;gap:10px;font-variant-numeric:tabular-nums;}
.sp-dl-tip-row strong{min-width:44px;text-align:right;}
.sp-dl-tip-bar{flex:1;height:4px;border-radius:2px;background:var(--sp-line);overflow:hidden;}
.sp-dl-tip-bar > i{display:block;height:100%;border-radius:2px;background:var(--sp-accent);transition:width .6s ease;}
.sp-dl-tip-facts{font-size:12.5px;font-variant-numeric:tabular-nums;}
@keyframes sp-dl-tip-in{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:none;}}
@media (prefers-reduced-motion:reduce){.sp-dl-tip{animation:none;}.sp-dl-tip-bar > i{transition:none;}}
/* Menus de la barre : seul « Steam » reste, habillé ; les autres passent dans Paramètres › Steam */
.RootMenuBar{padding-left:10px !important;gap:0;}
.RootMenuBar > .RootMenuButton:not(:first-child){display:none !important;}
.RootMenuBar > .RootMenuButton:first-child{height:30px;padding:0 12px 0 8px !important;margin:0 !important;border-radius:15px;background:var(--sp-surface2) !important;border:1px solid var(--sp-line);font-family:var(--sp-font) !important;font-weight:700 !important;font-size:13px !important;color:var(--sp-text) !important;display:flex !important;align-items:center;}
.RootMenuBar > .RootMenuButton:first-child:hover,.RootMenuBar > .RootMenuButton.MenuOpen{border-color:var(--sp-accent) !important;}
.RootMenuBar > .RootMenuButton:first-child *{color:inherit !important;font:inherit !important;}
/* Annonces + notifications réunies en une pilule « Actu » */
.TitleBarControls > .tool-tip-source:has(.AnnouncementsButton),.TitleBarControls > .tool-tip-source:has(.NotificationButtonContainer){height:30px;background:var(--sp-surface2);border:1px solid var(--sp-line);margin:0 !important;}
.TitleBarControls > .tool-tip-source:has(.AnnouncementsButton){border-right:0;border-radius:15px 0 0 15px;padding-left:12px;}
.TitleBarControls > .tool-tip-source:has(.AnnouncementsButton)::before{content:"Actu";font-family:var(--sp-font);font-weight:700;font-size:13px;color:var(--sp-text);margin-right:4px;}
.TitleBarControls > .tool-tip-source:has(.NotificationButtonContainer){border-left:0;border-right:0;border-radius:0;padding-right:0;}
/* Contacts et chat : dernier élément de la pilule Actu */
.sp-friends-host{display:flex;align-items:center;height:30px;background:var(--sp-surface2);border:1px solid var(--sp-line);border-left:0;border-radius:0 15px 15px 0;padding-right:6px;margin-right:8px;-webkit-app-region:no-drag;}
.sp-friends{position:relative;display:flex;align-items:center;justify-content:center;gap:4px;min-width:30px;height:28px;padding:0 4px;border:0;border-radius:14px;background:transparent;color:var(--sp-muted);cursor:pointer;-webkit-app-region:no-drag;corner-shape:round !important;}
.sp-friends:hover{color:var(--sp-text);background:var(--sp-surface);}
.sp-friends-n{font-family:var(--sp-font);font-size:11px;font-weight:800;color:var(--sp-online);}
/* Barre du bas de Steam : ses boutons sont dans la barre du haut et la bibliothèque.
   Le conteneur reste, car il affiche aussi les alertes de mise à jour du client.
   Pas de display:none : la barre contient la poignée de redimensionnement (.window_resize_grip) et Steam
   calcule la zone de redimensionnement depuis sa position ; sans position, toute la fenêtre devenait poignée. */
.BottomBarContainer > .BottomBar{visibility:hidden !important;flex:0 0 0 !important;height:0 !important;min-height:0 !important;max-height:0 !important;padding:0 !important;margin:0 !important;border:0 !important;overflow:hidden !important;}
.BottomBarContainer{background:transparent !important;border:0 !important;}
.TitleBarControls .AnnouncementsButton,.TitleBarControls .NotificationsButton{background:transparent !important;box-shadow:none !important;color:var(--sp-muted) !important;width:30px !important;min-width:30px !important;padding:0 !important;margin:0 !important;height:28px !important;border-radius:14px !important;display:flex !important;align-items:center;justify-content:center;}
.TitleBarControls .AnnouncementsButton:hover,.TitleBarControls .NotificationsButton:hover{color:var(--sp-text) !important;background:var(--sp-surface) !important;}
.TitleBarControls .AnnouncementsButton.Active,.TitleBarControls .NotificationsButton:not(.NoNew){color:var(--sp-accent) !important;}
.TitleBarControls .AnnouncementWaveSVG{display:none !important;}
/* Big Picture : pilule avec icône de manette et libellé */
.TopBar > .TitleBar .GamepadUIToggle{width:auto !important;height:30px !important;padding:0 13px 0 10px !important;margin:0 4px !important;gap:7px;border-radius:15px !important;background:var(--sp-surface2) !important;border:1px solid var(--sp-line) !important;color:var(--sp-text) !important;font-family:var(--sp-font) !important;font-weight:700;font-size:13px;}
.TopBar > .TitleBar .GamepadUIToggle svg{display:none !important;}
.TopBar > .TitleBar .GamepadUIToggle::before{content:"";width:19px;height:19px;background:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 11h4M8 9v4M15 12h.01M18 10h.01'/%3E%3Cpath d='M17.32 5H6.68a4 4 0 0 0-3.98 3.59l-.6 6A3 3 0 0 0 5.08 18c.86 0 1.67-.43 2.15-1.14L8 16h8l.77.86A2.6 2.6 0 0 0 18.92 18a3 3 0 0 0 2.98-3.41l-.6-6A4 4 0 0 0 17.32 5z'/%3E%3C/svg%3E") center/contain no-repeat;}
.TopBar > .TitleBar .GamepadUIToggle::after{content:"Big Picture";}
/* Boutons de fenêtre : pastille aux ronds colorés, symbole au survol */
.TopBar > .TitleBar .title-bar-actions.window-controls{flex-direction:row !important;gap:9px;height:30px !important;padding:0 12px !important;margin:0 12px 0 6px !important;border-radius:15px;background:var(--sp-surface2);border:1px solid var(--sp-line);}
.TopBar > .TitleBar .windowControlButton{width:14px !important;height:14px !important;min-width:14px !important;padding:0 !important;margin:0 !important;border-radius:50% !important;display:flex !important;align-items:center;justify-content:center;corner-shape:round !important;}
.TopBar > .TitleBar .windowControlButton.closeButton{order:3;background:#ff5f57 !important;}
.TopBar > .TitleBar .windowControlButton.minimizeButton{order:1;background:#febc2e !important;}
.TopBar > .TitleBar .windowControlButton.restoreButton,.TopBar > .TitleBar .windowControlButton.maximizeButton{order:2;background:#28c840 !important;}
/* macOS : ordre du système (fermer, réduire, agrandir), à gauche */
.OSX .windowControlButton.closeButton{order:1 !important;}
.OSX .windowControlButton.minimizeButton{order:2 !important;}
.OSX .windowControlButton:is(.maximizeButton,.restoreButton){order:3 !important;}
.TopBar.OSX > .TitleBar > .WindowControls{order:-1;}
.TopBar.OSX > .TitleBar .title-bar-actions.window-controls{margin:0 6px 0 12px !important;}
.TopBar > .TitleBar .windowControlButton:hover{filter:brightness(1.12);}
.TopBar > .TitleBar .windowControlButton .title-area-icon-inner{width:8px !important;height:8px !important;padding:0 !important;margin:0 !important;display:flex;opacity:0;transition:opacity .12s;}
.TopBar > .TitleBar .windowControlButton svg{width:8px !important;height:8px !important;}
.TopBar > .TitleBar .windowControlButton svg *{stroke:rgba(0,0,0,.62) !important;stroke-width:34 !important;}
.TopBar > .TitleBar .title-bar-actions:hover .title-area-icon-inner{opacity:1;}
/* Le trait de Steam pour « réduire » est en bas de son icône : on dessine un trait centré à la place */
.TopBar > .TitleBar .windowControlButton.minimizeButton svg{display:none !important;}
.TopBar > .TitleBar .windowControlButton.minimizeButton .title-area-icon-inner{align-items:center;justify-content:center;}
.TopBar > .TitleBar .windowControlButton.minimizeButton .title-area-icon-inner::after{content:"";width:8px;height:2px;border-radius:1px;background:rgba(0,0,0,.62);}
/* macOS : Steam dessine déjà ses symboles (×, −, +) en image dans les pastilles ; notre trait (pour Windows, sans symbole) s'y superposerait */
.OSX .windowControlButton.minimizeButton .title-area-icon-inner::after{content:none !important;}
.TopBar.OSX > .TitleBar .windowControlButton .title-area-icon-inner{width:14px !important;height:14px !important;background-size:contain !important;background-position:center !important;background-repeat:no-repeat !important;}
.TitleBarControls > .tool-tip-source:has(.NotificationButtonContainer) .NotificationButtonContainer,.TitleBarControls > .tool-tip-source:has(.NotificationButtonContainer) .NotificationButtonContainer > div{display:flex;align-items:center;width:auto !important;margin:0 !important;padding:0 !important;}
.TopBar > .TitleBar .GamepadUIToggle:hover{background:var(--sp-surface2) !important;color:var(--sp-text) !important;}

/* Page Téléchargements de Steam (/library/downloads) aux couleurs du thème */
.DownloadsPage,.DownloadsPage .Panel{background:var(--sp-bg) !important;}
.DownloadsPage,.DownloadsPage *{font-family:var(--sp-font) !important;}
.DownloadsPage .TopSection,.DownloadsPage .GraphAndStats{background:var(--sp-surface) !important;}
.DownloadsPage .TopSection{border-bottom:1px solid var(--sp-line);}
.DownloadsPage .SectionItemWrapper,.DownloadsPage .SectionItem,.DownloadsPage .SectionList{background:transparent !important;}
.DownloadsPage .HeroAndLogo{background:linear-gradient(to right,color-mix(in srgb,var(--sp-accent) 32%,transparent) 0%,transparent 55%) !important;}
.DownloadsPage .Gradient{background:linear-gradient(to right,var(--sp-surface) 0%,transparent 100%) !important;}
.DownloadsPage .Section,.DownloadsPage .Section.Empty,.DownloadsPage .Section.Active{background:var(--sp-surface) !important;border:1px solid var(--sp-line);border-radius:var(--sp-r-lg);margin:16px 24px !important;padding:14px 20px 18px !important;}
.DownloadsPage .TopSection .Section,.DownloadsPage .TopSection .Section.Active{margin:0 !important;border:0 !important;border-radius:0 !important;padding:0 !important;background:transparent !important;}
.DownloadsPage .SectionTitle .Title{color:var(--sp-text) !important;font-weight:800 !important;font-size:19px !important;letter-spacing:0 !important;}
.DownloadsPage .SectionTitle .Count,.DownloadsPage .AutoUpdate,.DownloadsPage .EmptyTransfers,.DownloadsPage .LegendText,.DownloadsPage .DetailsAndType{color:var(--sp-muted) !important;}
.DownloadsPage .Rule{background:var(--sp-line) !important;}
.DownloadsPage .Stat .Figure,.DownloadsPage .DownloadItemName,.DownloadsPage .Name{color:var(--sp-text) !important;}
.DownloadsPage .LegendBox.Network,.DownloadsPage .LegendBox:not(.Disk){background:var(--sp-accent) !important;}
.DownloadsPage .LegendBox.Disk,.DownloadsPage .Disk{background:var(--sp-online) !important;}
.DownloadsPage .DownloadGraph path,.DownloadsPage .DownloadGraph polyline,.DownloadsPage .GraphLine{stroke:var(--sp-accent) !important;}
.DownloadsPage .SectionItem{border-radius:var(--sp-r-md);padding:6px !important;}
.DownloadsPage .SectionItem:hover{background:var(--sp-surface2) !important;}
.DownloadsPage .LibraryItemBox,.DownloadsPage .LibraryItemBox *,.DownloadsPage .LandscapeImage{border-radius:var(--sp-r-sm) !important;}
.DownloadsPage .LibraryItemBoxShine{display:none !important;}
.DownloadsPage .DialogButton,.DownloadsPage .Button,.DownloadsPage .SettingsButton,.DownloadsPage .RemoveFromQueue,.DownloadsPage .RemoveAllButton{background:var(--sp-surface2) !important;color:var(--sp-text) !important;border:1px solid var(--sp-line) !important;border-radius:var(--sp-r-sm) !important;box-shadow:none !important;}
.DownloadsPage .DialogButton:hover,.DownloadsPage .Button:hover,.DownloadsPage .SettingsButton:hover,.DownloadsPage .RemoveFromQueue:hover,.DownloadsPage .RemoveAllButton:hover{border-color:var(--sp-accent) !important;}
.DownloadsPage .NumberOfCopies{background:rgba(0,0,0,.55) !important;}
.DownloadsPage [class*="ProgressBar"],.DownloadsPage [class*="Progress"] [class*="Track"]{background:var(--sp-surface2) !important;border-radius:3px !important;}
.DownloadsPage [class*="ProgressBar"] [class*="Fill"],.DownloadsPage [class*="Progress"] [class*="Fill"]{background:var(--sp-accent) !important;border-radius:3px !important;}

/* Menus natifs de Steam (clic droit, menus de la barre) aux couleurs du thème */
.contextMenu{background:var(--sp-surface) !important;border:1px solid var(--sp-line) !important;border-radius:var(--sp-r-md) !important;box-shadow:0 18px 44px rgba(0,0,0,.55) !important;padding:6px !important;font-family:var(--sp-font) !important;}
.contextMenuContents{background:transparent !important;}
.contextMenuItem{color:var(--sp-text) !important;font-family:var(--sp-font) !important;font-size:14px !important;border-radius:var(--sp-r-sm) !important;padding:8px 12px !important;background:transparent !important;}
.contextMenuItem:hover,.contextMenuItem:focus,.contextMenuItem[class*="active"],.contextMenuItem[class*="Selected"]{background:var(--sp-surface2) !important;color:var(--sp-text) !important;}
.contextMenuItem[class*="disabled"],.contextMenuItem[class*="Disabled"]{color:var(--sp-muted) !important;opacity:.6;}
.contextMenu .Separator{background:var(--sp-line) !important;height:1px !important;margin:4px 6px !important;border:0 !important;}
/* Steam dessine le séparateur en bordure haute de l'entrée suivante (arrondie, donc courbée) : un vrai trait à la place */
.DesktopUI .contextMenu .ContextMenuSeparator{height:1px !important;margin:4px 8px !important;background:var(--sp-line) !important;border:0 !important;}
.DesktopUI .contextMenu .ContextMenuSeparator + .contextMenuItem{border-top:0 !important;}
.ContextMenuPopupBody,body.ContextMenuPopup{background:transparent !important;}
/* Panneau des notifications (cloche) : fenêtre réutilisée par Steam, qui donne au menu une largeur minimale égale à sa
   largeur mesurée à l'ouverture précédente ; en content-box, padding et contour s'y ajoutaient et la fenêtre gagnait
   28 px à chaque ouverture. Largeur fixe, carte unique (plus de carte dans la carte), sans ombre (la fenêtre la coupait en carré). */
.contextMenu{box-sizing:border-box !important;}
.ContextMenuPosition:has(.NotificationsMenu){min-width:0 !important;width:360px !important;padding:8px !important;box-shadow:none !important;}
.contextMenu .NotificationsMenu{width:100% !important;max-width:none !important;margin:0 !important;padding:0 !important;background:transparent !important;border:0 !important;box-shadow:none !important;}
.contextMenu .NotificationsMenu > div{width:auto !important;margin:0 !important;padding:0 !important;background:transparent !important;border:0 !important;box-shadow:none !important;}
.contextMenu .NotificationHeader{display:flex !important;align-items:center;justify-content:space-between;gap:12px;height:auto !important;margin:0 !important;padding:4px 4px 10px 8px !important;background:transparent !important;border:0 !important;border-bottom:1px solid var(--sp-line) !important;}
.contextMenu .AllNotificationsTitle{margin:0 !important;font-size:15px !important;font-weight:800 !important;color:var(--sp-text) !important;}
.contextMenu .AllNotificationsButton{height:auto !important;min-width:0 !important;margin:0 !important;padding:5px 12px !important;background:var(--sp-surface2) !important;border:1px solid var(--sp-line) !important;border-radius:999px !important;box-shadow:none !important;color:var(--sp-text) !important;font-family:var(--sp-font) !important;font-size:12.5px !important;font-weight:700 !important;cursor:pointer;}
.contextMenu .AllNotificationsButton:hover{border-color:var(--sp-accent) !important;color:var(--sp-accent) !important;}
.contextMenu .NotificationsMenuScrollable{width:auto !important;height:auto !important;max-height:400px;margin:0 !important;padding:6px 0 0 !important;}
.contextMenu .NotificationsMenuEntriesContainer{display:flex;flex-direction:column;gap:2px;}
.contextMenu .EmptyNotificationsCtn{margin:0 !important;padding:14px 10px 8px !important;text-align:center;background:transparent !important;}
.contextMenu .EmptyNotificationsTitle{margin:0 0 4px !important;font-size:13px !important;font-weight:700 !important;color:var(--sp-text) !important;}
.contextMenu .EmptyNotificationsBody{margin:0 !important;font-size:12px !important;line-height:1.45 !important;color:var(--sp-muted) !important;}
.contextMenu .NotificationMenuItem{display:flex !important;align-items:center;gap:10px;margin:0 !important;padding:9px 10px !important;background:transparent !important;border:0 !important;border-radius:var(--sp-r-sm) !important;color:var(--sp-text) !important;font-size:13px !important;font-weight:600 !important;}
.contextMenu .NotificationMenuItem:hover,.contextMenu .NotificationMenuItem:focus{background:var(--sp-surface2) !important;}
.contextMenu .NotificationMenuItem svg{flex:none;width:18px !important;height:18px !important;color:var(--sp-accent) !important;}
/* Menu d'un jeu (pages/library/menu.tsx) : en-tête, icônes, titres de groupe */
.sp-mi-head{display:flex;flex-direction:column;gap:2px;min-width:250px;padding:8px 12px 10px;margin-bottom:6px;border-bottom:1px solid var(--sp-line);font-family:var(--sp-font);}
.sp-mi-title{font-weight:800;font-size:14px;color:var(--sp-text);max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.sp-mi-sub{font-size:12px;color:var(--sp-muted);}
.sp-mi-heading{padding:8px 12px 4px;font-family:var(--sp-font);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--sp-muted);}
.contextMenuItem:has(.sp-mi){padding:0 10px !important;min-height:40px;display:flex !important;align-items:center;}
.sp-mi{display:flex;align-items:center;gap:12px;flex:1;min-width:200px;}
.sp-mi-ic{display:inline-flex;justify-content:center;width:18px;flex:none;color:var(--sp-muted);}
.sp-mi-label{flex:1;}
.sp-mi--play{font-weight:800;}
.sp-mi--play .sp-mi-ic{color:var(--sp-accent);}
.sp-mi--danger,.sp-mi--danger .sp-mi-ic{color:var(--sp-busy);}
.sp-mi--on .sp-mi-ic{color:var(--sp-accent);}
html.sp-silent body{opacity:0 !important;}

/* Dans la barre de titre, Windows capte les clics pour déplacer la fenêtre : tout ce qui est cliquable doit être exclu */
.sp-topnav button,.sp-presence,.sp-pop,.sp-pop *{-webkit-app-region:no-drag;}
body.sp-idle .TopBar,body.sp-idle .BottomBarContainer{opacity:.35;transition:opacity 2s;}

/* Base */
.sp-root{position:relative;font-family:var(--sp-font);color:var(--sp-text);background:var(--sp-bg);font-size:14px;line-height:1.4;height:100%;overflow:auto;box-sizing:border-box;}
.sp-root *{box-sizing:border-box;}
/* :where() garde cette règle de base sans poids, pour que .sp-btn--primary & co. imposent leur couleur de texte */
:where(.sp-root,.sp-pop,.sp-topnav) button{font:inherit;color:inherit;cursor:pointer;}
.sp-root a{color:var(--sp-accent);text-decoration:none;cursor:pointer;}
.sp-root a:hover{text-decoration:underline;}
.sp-muted{color:var(--sp-muted);}
.sp-h1{margin:0;font-size:26px;font-weight:800;}
.sp-h2{margin:0;font-size:19px;font-weight:800;}
.sp-label{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--sp-muted);}
.sp-card{background:var(--sp-surface);border:1px solid var(--sp-line);border-radius:var(--sp-r-lg);}
.sp-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 16px;border-radius:var(--sp-r-sm);border:1px solid var(--sp-line);background:transparent;color:var(--sp-text);font-weight:600;transition:background .15s ease,box-shadow .15s ease;}
.sp-btn:hover:not(:disabled){background:var(--sp-surface2);}
.sp-btn:disabled{opacity:.35;cursor:default;}
.sp-btn--primary{background:var(--sp-accent);color:var(--sp-accent-ink);border:0;font-weight:800;box-shadow:var(--sp-glow);}
/* Survol du bouton à l'accent : plus clair (la règle .sp-btn:hover:not(:disabled), plus spécifique, le rendait gris et illisible) */
.sp-btn--primary:hover:not(:disabled){background:color-mix(in srgb,var(--sp-accent) 80%,#fff);}
.sp-btn--install{background:color-mix(in srgb,var(--sp-accent) 18%,var(--sp-surface2));border:1px solid color-mix(in srgb,var(--sp-accent) 55%,transparent);color:var(--sp-text);font-weight:800;}
.sp-btn--install:hover{background:color-mix(in srgb,var(--sp-accent) 28%,var(--sp-surface2));}
.sp-btn--install svg{color:var(--sp-accent);}
.sp-btn--big{height:52px;padding:0 30px;font-size:16px;}
.sp-btn--icon{width:40px;padding:0;}
.sp-pill{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:17px;border:1px solid var(--sp-line);background:transparent;color:var(--sp-text);font-size:13px;}
.sp-pill[aria-pressed="true"]{border-color:var(--sp-accent);background:var(--sp-surface2);font-weight:700;}
.sp-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:var(--sp-r-sm);font-size:11px;font-weight:800;}
.sp-bar{height:4px;border-radius:2px;background:var(--sp-surface2);overflow:hidden;}
.sp-bar > i{display:block;height:100%;background:var(--sp-accent);border-radius:2px;}
.sp-input{height:40px;padding:0 12px;border-radius:var(--sp-r-sm);border:1px solid var(--sp-line);background:var(--sp-surface2);color:var(--sp-text);outline:0;font:inherit;}
.sp-input:focus{border-color:var(--sp-accent);}
/* Interrupteur en pilule (nos réglages ; ceux de Steam reçoivent le même dessin) */
.sp-switch{flex:none;display:inline-flex;align-items:center;width:46px;height:26px;padding:3px;border-radius:13px;border:1px solid var(--sp-line);background:var(--sp-surface2);cursor:pointer;corner-shape:round !important;transition:background .15s,border-color .15s;}
.sp-switch::after{content:"";width:18px;height:18px;border-radius:50%;background:var(--sp-muted);transition:transform .15s,background .15s;}
.sp-switch[aria-checked="true"]{background:var(--sp-accent);border-color:var(--sp-accent);box-shadow:var(--sp-glow);}
.sp-switch[aria-checked="true"]::after{background:var(--sp-accent-ink);transform:translateX(20px);}
.sp-switch:focus-visible{outline:2px solid var(--sp-accent);outline-offset:3px;}
/* Curseur (position, volume) : --sp-fill donne la part remplie */
.sp-range{-webkit-appearance:none;appearance:none;flex:1;min-width:0;height:5px;margin:0;border-radius:3px;background:linear-gradient(to right,var(--sp-accent) var(--sp-fill,0%),var(--sp-surface2) var(--sp-fill,0%));cursor:pointer;corner-shape:round !important;}
.sp-range--soft{flex:none;background:linear-gradient(to right,var(--sp-text) var(--sp-fill,0%),var(--sp-surface2) var(--sp-fill,0%));}
.sp-range::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:var(--sp-text);border:0;opacity:0;transition:opacity .12s;}
.sp-range:hover::-webkit-slider-thumb,.sp-range:focus-visible::-webkit-slider-thumb{opacity:1;}
.sp-range:focus-visible{outline:2px solid var(--sp-accent);outline-offset:4px;}
/* Lecteur de musique (shell/MusicPlayer.tsx), sur toutes les pages du bureau tant qu'une bande-son joue */
.sp-player{position:fixed;left:16px;right:16px;bottom:16px;max-width:1500px;margin:0 auto;z-index:900;display:flex;flex-wrap:wrap;align-items:center;gap:22px;padding:12px 18px;border-radius:var(--sp-r-lg);background:var(--sp-surface);border:1px solid var(--sp-line);box-shadow:0 18px 44px rgba(0,0,0,.55);font-family:var(--sp-font);color:var(--sp-text);font-size:14px;box-sizing:border-box;}
.sp-player *{box-sizing:border-box;}
.sp-player button{font:inherit;color:inherit;cursor:pointer;}
.sp-player-now{flex:1 1 260px;min-width:0;display:flex;align-items:center;gap:12px;padding:0;border:0;background:transparent;text-align:left;}
.sp-player-title{font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sp-player-sub{font-size:12.5px;color:var(--sp-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sp-player-mid{flex:2 1 420px;min-width:0;display:flex;flex-direction:column;align-items:center;gap:6px;}
.sp-player-ctrls{display:flex;align-items:center;gap:10px;}
.sp-player-btn{width:36px;height:36px;padding:0;border:0;border-radius:50%;background:transparent;display:flex;align-items:center;justify-content:center;color:var(--sp-text);corner-shape:round !important;}
.sp-player-btn:hover{background:var(--sp-surface2);}
.sp-player-btn[aria-pressed]{color:var(--sp-muted);}
.sp-player-btn[aria-pressed="true"]{color:var(--sp-accent);}
.sp-player-main{width:44px;height:44px;background:var(--sp-accent);color:var(--sp-accent-ink);box-shadow:var(--sp-glow);}
.sp-player-main:hover{background:var(--sp-accent);filter:brightness(1.08);}
.sp-player-time{width:100%;display:flex;align-items:center;gap:10px;font-size:12px;color:var(--sp-muted);font-variant-numeric:tabular-nums;}
.sp-player-right{flex:1 1 200px;display:flex;align-items:center;justify-content:flex-end;gap:10px;color:var(--sp-muted);}
.sp-player-right .sp-player-btn{color:var(--sp-muted);}
body.sp-has-player .sp-root{padding-bottom:110px;}
/* Fenêtres-dialogues natives (À propos de Steam, Ajouter un jeu non Steam…) : fond du thème, barre de fenêtre transparente au-dessus du contenu */
/*@sp:dialog-window body.ModalDialogBody*/
.ModalDialogBody.DesktopUI:not(:has(.AppProperties)),.ModalDialogBody.DesktopUI:not(:has(.AppProperties)) .PopupFullWindow,.ModalDialogBody.DesktopUI:not(:has(.AppProperties)) .ModalPosition_Content > .DialogContent{background:var(--sp-surface) !important;background-image:none !important;}
.ModalDialogBody.DesktopUI:not(:has(.AppProperties)) .PopupFullWindow > .TitleBar{background:transparent !important;box-shadow:none !important;}
.ModalDialogBody.DesktopUI:not(:has(.AppProperties)) .ModalPosition_TopBar{display:none !important;}
.ModalDialogBody.DesktopUI:not(:has(.AppProperties)) .ModalPosition_Content > .DialogContent{font-family:var(--sp-font) !important;}
.ModalDialogBody.DesktopUI:not(:has(.AppProperties)) .ModalPosition_Content > .DialogContent *{font-family:var(--sp-font) !important;}
/*@sp:end*/
.DesktopUI .AboutSteamDialog .DialogHeader svg{color:var(--sp-text) !important;fill:var(--sp-text) !important;}
.DesktopUI .AboutSteamDialog .DialogBodyLabel{color:var(--sp-muted) !important;}
.DesktopUI .AboutSteamDialog .DialogBodyText{color:var(--sp-text) !important;}
.DesktopUI .PlayersDialog [class*="PlayersList"]:not([class*="Header"]):not([class*="Body"]):not([class*="Wrapper"]){background:var(--sp-bg) !important;border:1px solid var(--sp-line) !important;border-radius:18px;overflow:hidden;}
.DesktopUI .PlayersDialog [class*="PlayersListHeaderCtr"]{background:transparent !important;border-bottom:1px solid var(--sp-line);}
.DesktopUI .PlayersDialog [class*="PlayersListHeaderColumn"]{color:var(--sp-muted) !important;font-size:11px !important;font-weight:700 !important;letter-spacing:.08em;text-transform:uppercase;}
.DesktopUI .PlayersDialog [class*="CurrentSortCol"] [class*="PlayersListHeaderColumn"]{color:var(--sp-text) !important;}
.DesktopUI .PlayersDialog [class*="PlayersListBody"]{background:transparent !important;}
.DesktopUI .PlayersDialog [class*="Empty"]{color:var(--sp-muted) !important;}
.DesktopUI .PlayersDialog [class*="ColumnResizer"]{background:var(--sp-line) !important;}
/* Cases à cocher et listes déroulantes des fenêtres-dialogues (serveurs de jeu, joueurs…) */
.ModalDialogBody.DesktopUI .DialogCheckbox{width:20px !important;height:20px !important;border-radius:6px !important;border:1.5px solid var(--sp-muted) !important;background:transparent !important;box-shadow:none !important;}
.ModalDialogBody.DesktopUI .DialogCheckbox svg{opacity:0;}
.ModalDialogBody.DesktopUI .DialogCheckbox.Active{background:var(--sp-accent) !important;border-color:var(--sp-accent) !important;}
.ModalDialogBody.DesktopUI .DialogCheckbox.Active svg{opacity:1;}
.ModalDialogBody.DesktopUI .DialogCheckbox.Active svg *{fill:var(--sp-accent-ink) !important;stroke:var(--sp-accent-ink) !important;}
.ModalDialogBody.DesktopUI .DialogCheckbox_Container{color:var(--sp-text) !important;}
.ModalDialogBody.DesktopUI .DialogDropDown_Arrow svg,.ModalDialogBody.DesktopUI .DialogDropDown_Arrow svg *{fill:var(--sp-muted) !important;color:var(--sp-muted) !important;}
/* Serveurs de jeu */
.DesktopUI .ServerBrowserDialog [class*="SwitchTabButton"].Selected{background:var(--sp-surface2) !important;border-color:var(--sp-accent) !important;color:var(--sp-accent) !important;}
.DesktopUI .ServerBrowserDialog [class*="ServerList"]:not([class*="Header"]){background:var(--sp-bg) !important;border:1px solid var(--sp-line) !important;border-radius:18px;overflow:hidden;}
.DesktopUI .ServerBrowserDialog [class*="ServerListHeaderCtr"]{background:transparent !important;border-bottom:1px solid var(--sp-line);color:var(--sp-muted) !important;}
.DesktopUI .ServerBrowserDialog [class*="ServerListHeaderCtr"] *{color:var(--sp-muted) !important;font-weight:700 !important;}
.DesktopUI .ServerBrowserDialog [class*="ColumnResizer"]{background:var(--sp-line) !important;border:0 !important;width:1px !important;}
.DesktopUI .ServerBrowserDialog [class*="CurrentFiltersSummaryText"],.DesktopUI .ServerBrowserDialog .DialogLabel{color:var(--sp-muted) !important;}
/* Mode réduit (menu Afficher › Mode réduit) : liste compacte native de la bibliothèque */
/*@sp:native-list .GameListEntryContainer*/
[class*="ContentFrame"]:has(.GameListEntryContainer){background:var(--sp-bg) !important;font-family:var(--sp-font) !important;}
[class*="ContentFrame"]:has(.GameListEntryContainer) *{font-family:var(--sp-font) !important;}
[class*="ContentFrame"]:has(.GameListEntryContainer) [class*="Container"]{background-image:none !important;}
[class*="ContentFrame"]:has(.GameListEntryContainer) [class*="SearchInput"] .DialogInput{background:var(--sp-surface2) !important;border:1px solid var(--sp-line) !important;border-radius:var(--sp-r-sm) !important;color:var(--sp-text) !important;}
[class*="ContentFrame"]:has(.GameListEntryContainer) [class*="SearchInput"] .DialogInput:focus{border-color:var(--sp-accent) !important;}
[class*="ContentFrame"]:has(.GameListEntryContainer) [class*="SectionHeaderContent"]{color:var(--sp-muted) !important;font-size:11px !important;font-weight:700 !important;letter-spacing:.08em;text-transform:uppercase;}
[class*="ContentFrame"]:has(.GameListEntryContainer) [class*="CollapseIconParent"]{background:transparent !important;}
[class*="ContentFrame"]:has(.GameListEntryContainer) .GameListEntryContainer{color:var(--sp-muted) !important;}
[class*="ContentFrame"]:has(.GameListEntryContainer) [class*="Installed"] .GameListEntryContainer{color:var(--sp-text) !important;font-weight:600;}
[class*="ContentFrame"]:has(.GameListEntryContainer) [class*="Container"]:has(> .GameListEntryContainer){border-radius:8px;}
[class*="ContentFrame"]:has(.GameListEntryContainer) [class*="Container"]:has(> .GameListEntryContainer):hover{background:var(--sp-surface2) !important;}
[class*="ContentFrame"]:has(.GameListEntryContainer) .GameListEntryContainer img{border-radius:5px;}
/*@sp:end*/
/* Ajouter un jeu non Steam (fenêtre native) : liste en carte, lignes, cases et en-tête aux couleurs du thème */
.DesktopUI .AddNonSteamGameDialog{background:var(--sp-surface) !important;}
/*@sp:dialog-window-2 body.ModalDialogBody*/
.ModalDialogBody.DesktopUI:has(.AddNonSteamGameDialog){background:var(--sp-surface) !important;}
/*@sp:end*/
.DesktopUI .AddNonSteamGameDialog{font-family:var(--sp-font) !important;}
.DesktopUI .AddNonSteamGameDialog *{font-family:var(--sp-font) !important;}
.DesktopUI .AddNonSteamGameDialog .DialogBodyText{color:var(--sp-muted) !important;margin-bottom:12px !important;}
.DesktopUI .AddNonSteamGameDialog [class*="Header"]:not(.DialogHeader){background:transparent !important;color:var(--sp-muted) !important;font-size:11px !important;font-weight:700 !important;letter-spacing:.08em;text-transform:uppercase;border:0 !important;}
.DesktopUI .AddNonSteamGameDialog [class*="GameList"]{background:var(--sp-bg) !important;border:1px solid var(--sp-line);border-radius:18px;padding:4px;box-sizing:border-box;}
.DesktopUI .AddNonSteamGameDialog [class*="GameRow"]{min-height:40px;border-radius:12px;background:transparent !important;}
.DesktopUI .AddNonSteamGameDialog [class*="GameRow"]:hover,.DesktopUI .AddNonSteamGameDialog [class*="GameRow"]:has(.DialogCheckbox.Active){background:var(--sp-surface2) !important;}
.DesktopUI .AddNonSteamGameDialog [class*="AppName"]{color:var(--sp-text) !important;font-weight:700 !important;}
.DesktopUI .AddNonSteamGameDialog [class*="ExePath"]{color:var(--sp-muted) !important;font-size:12px !important;}
.DesktopUI .AddNonSteamGameDialog [class*="IconContainer"] img{border-radius:7px;}
.DesktopUI .AddNonSteamGameDialog .DialogCheckbox{width:20px !important;height:20px !important;border-radius:6px !important;border:1.5px solid var(--sp-muted) !important;background:transparent !important;box-shadow:none !important;}
.DesktopUI .AddNonSteamGameDialog .DialogCheckbox svg{opacity:0;}
.DesktopUI .AddNonSteamGameDialog .DialogCheckbox.Active{background:var(--sp-accent) !important;border-color:var(--sp-accent) !important;}
.DesktopUI .AddNonSteamGameDialog .DialogCheckbox.Active svg{opacity:1;color:var(--sp-accent-ink) !important;fill:var(--sp-accent-ink) !important;}
.DesktopUI .AddNonSteamGameDialog .DialogCheckbox.Active svg *{fill:var(--sp-accent-ink) !important;stroke:var(--sp-accent-ink) !important;}
/* Superposition en jeu (Maj + Tab) : barre d'outils et fenêtres d'outils en cartes. Écrit d'après les noms de classes de Steam. */
.TopSection:has(.GameName):not(.GamepadMode *),.ToolbarContainer:not(.GamepadMode *),.OverlayPopup:not(.GamepadMode *){font-family:var(--sp-font) !important;}
.TopSection .GameName{font-weight:800 !important;color:var(--sp-text) !important;}
.TopSection :is(.PlaytimeCurrentSession,.CurrentDate,.KBShortcut){color:var(--sp-muted) !important;}
.TopSection .CurrentTime{font-weight:800 !important;color:var(--sp-text) !important;}
.ToolbarContainer .Toolbar{background:var(--sp-surface) !important;border:1px solid var(--sp-line) !important;border-radius:var(--sp-r-lg) !important;box-shadow:0 18px 44px rgba(0,0,0,.55) !important;}
.ToolbarContainer .ToolbarButton{border-radius:var(--sp-r-sm) !important;background:transparent !important;color:var(--sp-text) !important;}
.ToolbarContainer .ToolbarButton:hover{background:var(--sp-surface2) !important;}
.ToolbarContainer .ToolbarButton.Toggled{background:var(--sp-surface2) !important;color:var(--sp-accent) !important;}
.OverlayPopup:not(.GamepadMode *){border-radius:var(--sp-r-lg) !important;border:1px solid var(--sp-line) !important;background:var(--sp-surface) !important;overflow:hidden;}
/* Connexion et choix du compte (fenêtre native, visible seulement déconnecté) */
[class*="LoginStaticBackground"],[class*="LoginBackground"]{background:var(--sp-bg) !important;background-image:none !important;}
.UserChooser,.UserChooser *,.LoginForm,.LoginForm *{font-family:var(--sp-font) !important;}
.UserChooser .WhosPlaying{font-size:24px !important;font-weight:800 !important;color:var(--sp-text) !important;text-transform:none !important;letter-spacing:0 !important;}
.UserChooser .AvatarContainer{border-radius:var(--sp-r-lg) !important;}
.UserChooser .UserAvatar,.UserChooser .UserAvatar img{border-radius:50% !important;corner-shape:round !important;}
.UserChooser .UserAccountName{font-weight:800 !important;color:var(--sp-text) !important;}
.LoginForm .FieldLabel{color:var(--sp-muted) !important;text-transform:none !important;letter-spacing:0 !important;font-size:12.5px !important;}
.LoginForm .FieldLabel.Highlight{color:var(--sp-accent) !important;}
.LoginForm .TextInput{background:var(--sp-surface2) !important;border:1px solid var(--sp-line) !important;border-radius:var(--sp-r-md) !important;color:var(--sp-text) !important;box-shadow:none !important;}
.LoginForm .TextInput:focus{border-color:var(--sp-accent) !important;}
.LoginForm .SubmitButton{background:var(--sp-accent) !important;color:var(--sp-accent-ink) !important;border-radius:var(--sp-r-md) !important;font-weight:800 !important;box-shadow:var(--sp-glow) !important;}
.LoginForm .Checkbox{border-radius:6px !important;}
[class*="QRCodeContainer"]{border-radius:var(--sp-r-md) !important;overflow:hidden;}
/* Notifications du bureau : une petite fenêtre par notification (283 × 70 px, taille fixée par Steam), écartée des bords
   de l'écran par features/toastSkin.ts. Carte « Fondu » : bande et intitulé de la couleur du type (accent par défaut,
   contact en vert, succès en or), image de la notification floutée en fondu à gauche (--sp-toast-img, posée par toastSkin). */
.DesktopToastContainer{background:transparent !important;overflow:hidden;}
.DesktopToastContainer *{font-family:var(--sp-font) !important;}
.DesktopToastContainer > div{height:100vh;}
.DesktopToastContainer .Middle{--sp-toast-c:var(--sp-accent);position:relative;box-sizing:border-box;height:100vh !important;overflow:hidden;background:var(--sp-surface) !important;border:1px solid var(--sp-line);border-radius:var(--sp-r-lg);}
.DesktopToastContainer .Middle:has(.GroupMessageBody,.AvatarStatus,.FriendOnlineColor,.FriendInGameAppColor){--sp-toast-c:var(--sp-online);}
.DesktopToastContainer .Middle:has(.AchievementIconWrapper){--sp-toast-c:var(--sp-trophy);}
.DesktopToastContainer .Middle::before{display:none !important;}
.DesktopToastContainer .Middle::after{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--sp-toast-c);z-index:2;}
.DesktopToastContainer .DesktopToastBackground{display:block !important;position:absolute !important;left:0 !important;top:0 !important;bottom:0 !important;width:60% !important;height:auto !important;background:var(--sp-toast-img, none) center/cover no-repeat !important;filter:blur(16px) saturate(1.4) !important;opacity:.5 !important;transform:scale(1.3) !important;transform-origin:left center;-webkit-mask-image:linear-gradient(90deg,#000 15%,transparent 85%);mask-image:linear-gradient(90deg,#000 15%,transparent 85%);z-index:0;pointer-events:none;}
.DesktopToastContainer .DesktopToastBackground > *{display:none !important;}
.DesktopToastContainer .Panel{position:relative;z-index:1;box-sizing:border-box;height:100% !important;background:transparent !important;}
.DesktopToastContainer .DesktopToastTemplate{box-sizing:border-box !important;height:100% !important;padding:0 12px 0 16px !important;align-items:center !important;background:transparent !important;}
.DesktopToastContainer .AppLogo,.DesktopToastContainer .AppLogo .Container,.DesktopToastContainer .AppLogo img,.DesktopToastContainer .AchievementIconWrapper,.DesktopToastContainer .AchievementIconWrapper img{border-radius:10px !important;}
.DesktopToastContainer .AppLogo .Container{background:var(--sp-surface2) !important;}
.DesktopToastContainer .Panel > div:first-child > img{border-radius:50% !important;corner-shape:round !important;}
.DesktopToastContainer .AvatarStatus,.DesktopToastContainer .GroupMessageIcon{display:none !important;}
.DesktopToastContainer .Content{color:var(--sp-text) !important;display:flex !important;flex-direction:column;justify-content:center;align-self:stretch;margin-top:0 !important;margin-bottom:0 !important;}
.DesktopToastContainer .AchievementTextSection{justify-content:center !important;}
.DesktopToastContainer .Header .Icon{display:none !important;}
.DesktopToastContainer .Header .Title,.DesktopToastContainer .Middle:has(.GroupMessageBody) .Body::before,.DesktopToastContainer .Middle:has(.AchievementIconWrapper) .NameAndDesc::before{display:block;font-size:10px !important;line-height:12px !important;font-weight:700 !important;letter-spacing:.08em;text-transform:uppercase;color:var(--sp-toast-c) !important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.DesktopToastContainer .Middle:has(.GroupMessageBody) .Body::before{content:"Message";}
.DesktopToastContainer .Middle:has(.AchievementIconWrapper) .NameAndDesc::before{content:"Succès débloqué";}
.DesktopToastContainer .Content > div:nth-child(2){font-weight:800 !important;color:var(--sp-text) !important;}
.DesktopToastContainer .Content > div:nth-child(n+3),.DesktopToastContainer .StandardNotificationSubText,.DesktopToastContainer .Desc{color:var(--sp-muted) !important;}
.DesktopToastContainer .Body > div:first-child,.DesktopToastContainer .NameAndDesc .Name{font-weight:800 !important;color:var(--sp-text) !important;line-height:16px !important;}
.DesktopToastContainer .GroupMessageBody{color:var(--sp-muted) !important;line-height:14px !important;}
.DesktopToastContainer .FriendOnlineColor,.DesktopToastContainer .FriendGame,.DesktopToastContainer .FriendInGameAppColor{color:var(--sp-online) !important;}
.DesktopToastContainer .ProgressBar{background:var(--sp-toast-c) !important;}
/* Raccourci musique de Steam dans la barre du haut : remplacé par notre lecteur */
.TitleBarControls > .tool-tip-source:has(> .SoundtrackControls){display:none !important;}
/* ---------- Composants natifs de Steam (Paramètres intégrés, Propriétés, dialogues) ---------- */
/* Paramètres de Steam intégrés à notre page : c'est notre colonne qui navigue, le cadre modal disparaît */
.sp-steamset .PagedSettingsDialog_PageListColumn,.sp-steamset .ModalPosition_Dismiss{display:none !important;}
.sp-steamset .ModalPosition,.sp-steamset .ModalPosition_Content,.sp-steamset .PagedSettingsDialog,.sp-steamset .PagedSettingDialog_ContentColumn,.sp-steamset .PagedSettingsDialog_PageContent,.sp-steamset .DialogContent_InnerWidth,.sp-steamset .DialogBody{position:static !important;display:block !important;width:auto !important;max-width:none !important;height:auto !important;max-height:none !important;min-height:0 !important;margin:0 !important;padding:0 !important;background:transparent !important;box-shadow:none !important;overflow:visible !important;-webkit-mask:none !important;mask:none !important;animation:none !important;}
.sp-steamset .DialogHeader{margin:0 0 18px !important;padding:0 !important;font-family:var(--sp-font) !important;font-size:26px !important;font-weight:800 !important;color:var(--sp-text) !important;text-transform:none !important;letter-spacing:0 !important;}
.sp-steamset .DialogHeader::before{content:"Steam";display:block;margin-bottom:6px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--sp-muted);}
/* Rangées de réglages : réunies en cartes, une ligne entre deux rangées */
.DesktopUI :is(.sp-steamset,.AppProperties) .Field{background:var(--sp-surface) !important;border:1px solid var(--sp-line) !important;border-top-width:0 !important;border-radius:0 !important;margin:0 !important;padding:14px 22px !important;box-shadow:none !important;}
.DesktopUI :is(.sp-steamset,.AppProperties) .Field + .Field{background:linear-gradient(var(--sp-line),var(--sp-line)) 22px 0/calc(100% - 44px) 1px no-repeat,var(--sp-surface) !important;}
.DesktopUI :is(.sp-steamset,.AppProperties) :is(:not(.Field) + .Field,.Field:first-child){border-top-width:1px !important;border-top-left-radius:var(--sp-r-lg) !important;border-top-right-radius:var(--sp-r-lg) !important;margin-top:12px !important;}
.DesktopUI :is(.sp-steamset,.AppProperties) .Field:not(:has(+ .Field)){border-bottom-left-radius:var(--sp-r-lg) !important;border-bottom-right-radius:var(--sp-r-lg) !important;margin-bottom:12px !important;}
.DesktopUI :is(.sp-steamset,.AppProperties) .Field::before,.DesktopUI :is(.sp-steamset,.AppProperties) .Field::after{display:none !important;}
.DesktopUI :is(.sp-steamset,.AppProperties,.GenericDialogBase,.InstallRequestModal,.EulaModalDialog),.DesktopUI :is(.sp-steamset,.AppProperties,.GenericDialogBase,.InstallRequestModal,.EulaModalDialog) *:not(svg *){font-family:var(--sp-font) !important;}
.DesktopUI :is(.sp-steamset,.AppProperties) .FieldLabel,.DesktopUI :is(.sp-steamset,.AppProperties) .EntryLabel{color:var(--sp-text) !important;font-weight:700 !important;font-size:14px !important;}
.DesktopUI :is(.sp-steamset,.AppProperties) :is(.FieldDescription,.EntryValue,.SettingsDialogBodyText,.SettingsDialogDescriptionText,.DialogBodyText,.SecondaryText,.Detail){color:var(--sp-muted) !important;}
.DesktopUI :is(.sp-steamset,.AppProperties) .FieldDescription{font-size:12px !important;line-height:1.45 !important;}
.DesktopUI :is(.sp-steamset,.AppProperties) :is(.SettingsDialogSubHeader,.DialogSubHeader,.Title){color:var(--sp-text) !important;font-size:17px !important;font-weight:800 !important;text-transform:none !important;letter-spacing:0 !important;margin-top:22px !important;}
.DesktopUI :is(.SettingsLink,a){color:var(--sp-accent) !important;}
/* Interrupteurs : même pilule que les nôtres (.sp-switch) */
.DesktopUI .Toggle{position:relative !important;flex:none;width:46px !important;height:26px !important;min-width:46px !important;}
.DesktopUI .ToggleRail{position:absolute !important;inset:0 !important;width:auto !important;height:auto !important;box-sizing:border-box;border-radius:13px !important;border:1px solid var(--sp-line) !important;background:var(--sp-surface2) !important;corner-shape:round !important;transition:background .15s,border-color .15s;}
.DesktopUI .Toggle.On .ToggleRail{background:var(--sp-accent) !important;border-color:var(--sp-accent) !important;box-shadow:var(--sp-glow);}
.DesktopUI .ToggleSwitch{position:absolute !important;top:4px !important;left:4px !important;width:18px !important;height:18px !important;margin:0 !important;border-radius:50% !important;background:var(--sp-muted) !important;box-shadow:none !important;transform:none !important;transition:left .15s,background .15s !important;corner-shape:round !important;}
.DesktopUI .Toggle.On .ToggleSwitch{left:24px !important;background:var(--sp-accent-ink) !important;}
.DesktopUI .Toggle.Disabled{opacity:.45;}
.DesktopUI .ToggleRail::before,.DesktopUI .ToggleRail::after{display:none !important;}
/* Curseurs et boutons segmentés (volume, seuil de transmission…) */
.DesktopUI .SliderTrack::before{background:var(--sp-accent) !important;}
.DesktopUI :is(.Percent,.DriveUsageGames,.Pip.ActivePip){background-color:var(--sp-accent) !important;}
.sp-steamset .ModalPosition_TopBar{display:none !important;}
.DesktopUI .RadioButton{background:var(--sp-surface2) !important;color:var(--sp-muted) !important;border-radius:var(--sp-r-sm) !important;box-shadow:none !important;}
.DesktopUI .RadioButton:not(.Active):hover{color:var(--sp-text) !important;}
.DesktopUI .RadioButton.Active{background:var(--sp-accent) !important;color:var(--sp-accent-ink) !important;font-weight:800 !important;}
/* Listes déroulantes, champs, boutons */
.DesktopUI .DialogDropDown{height:40px !important;min-height:40px;padding:0 12px 0 14px !important;display:flex !important;align-items:center;gap:10px;border-radius:var(--sp-r-sm) !important;border:1px solid var(--sp-line) !important;background:var(--sp-surface2) !important;color:var(--sp-text) !important;font-weight:600 !important;box-shadow:none !important;}
.DesktopUI .DialogDropDown:hover{border-color:var(--sp-accent) !important;}
.DesktopUI .DialogDropDown_Arrow{color:var(--sp-muted) !important;fill:var(--sp-muted) !important;}
.DesktopUI :is(.DialogInput,.DialogTextInputBase,textarea){box-sizing:border-box !important;height:auto;min-height:42px;padding:0 14px !important;border-radius:var(--sp-r-sm) !important;border:1px solid var(--sp-line) !important;background:var(--sp-surface2) !important;color:var(--sp-text) !important;box-shadow:none !important;outline:0 !important;}
.DesktopUI :is(.DialogInput,.DialogTextInputBase,textarea):focus{border-color:var(--sp-accent) !important;}
.DesktopUI .DialogButton{min-height:38px;padding:0 16px !important;border-radius:var(--sp-r-sm) !important;border:1px solid var(--sp-line) !important;background:var(--sp-surface2) !important;color:var(--sp-text) !important;font-weight:600 !important;box-shadow:none !important;text-shadow:none !important;}
.DesktopUI .DialogButton:not(:disabled):hover{border-color:var(--sp-accent) !important;background:var(--sp-surface2) !important;color:var(--sp-text) !important;}
.DesktopUI .DialogButton.Primary{background:var(--sp-accent) !important;border-color:var(--sp-accent) !important;color:var(--sp-accent-ink) !important;font-weight:800 !important;box-shadow:var(--sp-glow) !important;}
.DesktopUI .DialogButton.Primary:not(:disabled):hover{background:var(--sp-accent) !important;color:var(--sp-accent-ink) !important;filter:brightness(1.08);}
.DesktopUI .DialogButton:is(:disabled,.Disabled){opacity:.4 !important;filter:none !important;cursor:default !important;}
/* Gros boutons (Compte : ajouter des fonds, confidentialité…) */
.sp-steamset .FatButtonRow{gap:12px !important;margin:12px 0 !important;}
.sp-steamset .FatButton{background:var(--sp-surface) !important;border:1px solid var(--sp-line) !important;border-radius:var(--sp-r-lg) !important;}
.sp-steamset .FatButton:not(:disabled):hover{border-color:var(--sp-accent) !important;background:var(--sp-surface2) !important;}
.sp-steamset .FatButton svg{color:var(--sp-accent);fill:currentColor;}
.sp-steamset .FatButton .Label{font-weight:800 !important;}
.sp-steamset .FatButton .Details{color:var(--sp-muted) !important;}

/* Fenêtre Propriétés d'un jeu */
.DesktopUI .AppProperties,.DesktopUI .AppProperties :is(.PagedSettingDialog_ContentColumn,.PagedSettingsDialog_PageContent){background:var(--sp-bg) !important;}
/*@sp:dialog-window-3 body.ModalDialogBody*/
.ModalDialogBody.DesktopUI:has(.AppProperties){background:var(--sp-bg) !important;}
.ModalDialogBody.DesktopUI:has(.AppProperties) .TitleBar{background:transparent !important;}
/*@sp:end*/
.DesktopUI .AppProperties .PagedSettingsDialog_PageListColumn{background:var(--sp-surface) !important;border-right:1px solid var(--sp-line);padding:44px 12px 12px !important;box-sizing:border-box;}
.DesktopUI .AppProperties .PagedSettingsDialog_Title{padding:0 12px 14px !important;margin:0 !important;font-size:16px !important;font-weight:800 !important;line-height:1.25 !important;color:var(--sp-text) !important;text-transform:none !important;letter-spacing:0 !important;white-space:normal !important;}
.DesktopUI .AppProperties .PagedSettingsDialog_Title::before{content:"Propriétés";display:block;margin-bottom:4px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--sp-muted);}
.DesktopUI .AppProperties .PagedSettingsDialog_PageListItem{height:36px !important;min-height:0 !important;padding:0 12px !important;display:flex !important;align-items:center;margin:0 0 2px !important;border-radius:var(--sp-r-sm) !important;background:transparent !important;color:var(--sp-muted) !important;font-weight:500 !important;}
.DesktopUI .AppProperties .PagedSettingsDialog_PageListItem:hover{color:var(--sp-text) !important;}
.DesktopUI .AppProperties .PagedSettingsDialog_PageListItem.Active{background:var(--sp-surface2) !important;color:var(--sp-text) !important;font-weight:700 !important;}
.DesktopUI .AppProperties .PageListItem_Title{color:inherit !important;font-weight:inherit !important;}
.DesktopUI .AppProperties .DialogHeader{color:var(--sp-text) !important;font-size:22px !important;font-weight:800 !important;text-transform:none !important;letter-spacing:0 !important;}
.DesktopUI .AppProperties .SteamCloudUsage{color:var(--sp-muted) !important;}
.DesktopUI .AppProperties .BlueHighlight{color:var(--sp-accent) !important;}
/* Boutons de fenêtre des fenêtres natives à part (Propriétés…) : mêmes ronds colorés que la fenêtre principale */
.ModalDialogBody.DesktopUI .TitleBar .title-bar-actions.window-controls,.ModalDialogBody.DesktopUI .TitleBar > div:has(> .windowControlButton){flex-direction:row !important;gap:8px;align-items:center;height:26px !important;padding:0 10px !important;margin:7px 10px 0 0 !important;border-radius:13px;background:var(--sp-surface2);border:1px solid var(--sp-line);corner-shape:round !important;}
.ModalDialogBody.DesktopUI .TitleBar .windowControlButton{width:13px !important;height:13px !important;min-width:13px !important;padding:0 !important;margin:0 !important;border-radius:50% !important;display:flex !important;corner-shape:round !important;}
.ModalDialogBody.DesktopUI .TitleBar .windowControlButton.closeButton{order:3;background:#ff5f57 !important;}
.ModalDialogBody.DesktopUI .TitleBar .windowControlButton.minimizeButton{order:1;background:#febc2e !important;}
.ModalDialogBody.DesktopUI .TitleBar .windowControlButton:is(.maximizeButton,.restoreButton){order:2;background:#28c840 !important;}
.ModalDialogBody.DesktopUI .TitleBar .windowControlButton > *{display:none !important;}

/* Dialogues natifs (activer un produit, désinstaller, confirmations…) */
.DesktopUI .FullModalOverlay{background:rgba(0,0,0,.66) !important;}
/*@sp:modal .ModalPosition*/
.DesktopUI .ModalPosition:has(:is(.GenericDialogBase,.InstallRequestModal,.EulaModalDialog)) .ModalPosition_TopBar{display:none !important;}
/*@sp:end*/
.DesktopUI :is(.GenericDialogBase,.InstallRequestModal,.EulaModalDialog) .DialogContent_InnerWidth{overflow-x:hidden !important;}
.DesktopUI :is(.GenericDialogBase,.InstallRequestModal,.EulaModalDialog){background:var(--sp-surface) !important;background-image:none !important;border:1px solid var(--sp-line) !important;border-radius:var(--sp-r-lg) !important;padding:28px !important;box-shadow:0 30px 80px rgba(0,0,0,.6) !important;color:var(--sp-text) !important;}
.DesktopUI :is(.GenericDialogBase,.InstallRequestModal,.EulaModalDialog)::before,.DesktopUI :is(.GenericDialogBase,.InstallRequestModal,.EulaModalDialog)::after{display:none !important;}
.DesktopUI :is(.GenericDialogBase,.InstallRequestModal,.EulaModalDialog) .DialogHeader{color:var(--sp-text) !important;font-size:21px !important;font-weight:800 !important;text-transform:none !important;letter-spacing:0 !important;padding:0 40px 0 0 !important;margin:0 0 12px !important;}
.DesktopUI :is(.GenericDialogBase,.InstallRequestModal,.EulaModalDialog) :is(.DialogBodyText,.InfoBody){color:var(--sp-muted) !important;line-height:1.5 !important;}
.DesktopUI :is(.GenericDialogBase,.InstallRequestModal,.EulaModalDialog) .InfoExampleHeader{color:var(--sp-muted) !important;font-size:11px !important;font-weight:700 !important;letter-spacing:.08em !important;}
.DesktopUI :is(.GenericDialogBase,.InstallRequestModal,.EulaModalDialog) .DialogFooter{display:flex !important;justify-content:flex-end;gap:10px;margin-top:20px !important;}
.DesktopUI :is(.GenericDialogBase,.InstallRequestModal,.EulaModalDialog) .DialogFooter > *{display:flex !important;gap:10px;flex:none !important;width:auto !important;}
.DesktopUI :is(.GenericDialogBase,.InstallRequestModal,.EulaModalDialog) .DialogFooter .DialogButton{width:auto !important;min-width:0 !important;flex:none !important;margin:0 !important;}
.DesktopUI :is(.GenericDialogBase,.InstallRequestModal,.EulaModalDialog) .DialogFooter .DialogButton.Secondary{order:-1;}
/*@sp:modal-2 .ModalPosition*/
.DesktopUI .ModalPosition:has(:is(.GenericDialogBase,.InstallRequestModal,.EulaModalDialog)) .ModalPosition_Dismiss{top:16px !important;right:16px !important;width:32px !important;height:32px !important;z-index:2;}
.DesktopUI .ModalPosition:has(:is(.GenericDialogBase,.InstallRequestModal,.EulaModalDialog)) .closeButton{width:32px !important;height:32px !important;border-radius:50% !important;background:var(--sp-surface2) !important;display:flex !important;align-items:center;justify-content:center;corner-shape:round !important;}
.DesktopUI .ModalPosition:has(:is(.GenericDialogBase,.InstallRequestModal,.EulaModalDialog)) .closeButton svg{width:12px !important;height:12px !important;}
.DesktopUI .ModalPosition:has(:is(.GenericDialogBase,.InstallRequestModal,.EulaModalDialog)) .closeButton svg *{stroke:var(--sp-muted) !important;}
/*@sp:end*/
/* Installation d'un jeu (InstallRequestModal) : jeux à installer, raccourcis, choix du disque */
.DesktopUI .InstallRequestModal{width:min(560px,calc(100vw - 48px)) !important;max-width:none !important;}
.DesktopUI .InstallRequestModal :is(.DialogHeader,.DialogBody,.DialogBodyText,.AppsToInstall){border:0 !important;box-shadow:none !important;}
.DesktopUI .InstallRequestModal .DialogBodyText{display:flex !important;flex-direction:column;gap:18px;margin:0 !important;}
.DesktopUI .InstallRequestModal .DialogFooter{padding-top:0 !important;margin-top:24px !important;}
.DesktopUI .InstallRequestModal .FolderSelector{padding:0 !important;}
.DesktopUI .InstallRequestModal .AppsToInstall{display:flex !important;flex-direction:column;gap:8px;max-height:240px;overflow-y:auto;margin:0 !important;}
.DesktopUI .InstallRequestModal .AppToInstall{display:flex !important;align-items:center;gap:14px;padding:10px 14px 10px 10px !important;margin:0 !important;background:var(--sp-surface2) !important;border:1px solid var(--sp-line) !important;border-radius:var(--sp-r-md) !important;}
.DesktopUI .InstallRequestModal .AppLogo{width:120px !important;height:45px !important;flex:none;border-radius:var(--sp-r-sm) !important;overflow:hidden;background:var(--sp-bg) !important;}
.DesktopUI .InstallRequestModal .AppLogo img{width:100% !important;height:100% !important;object-fit:cover;}
.DesktopUI .InstallRequestModal .AppName{flex:1 1 auto;min-width:0;color:var(--sp-text) !important;font-size:15px !important;font-weight:700 !important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.DesktopUI .InstallRequestModal .DiskSpace{color:var(--sp-muted) !important;font-size:13px !important;font-weight:600 !important;text-transform:none !important;letter-spacing:0 !important;font-variant-numeric:tabular-nums;}
.DesktopUI .InstallRequestModal .AppSizeRequired{flex:none;}
.DesktopUI .InstallRequestModal .CreateShortcuts{display:flex !important;flex-wrap:wrap;gap:10px 24px;margin:0 !important;}
.DesktopUI .InstallRequestModal .DialogCheckbox_Container{display:flex !important;align-items:center;gap:10px;padding:0 !important;margin:0 !important;color:var(--sp-text) !important;cursor:pointer;}
.DesktopUI .InstallRequestModal .DialogToggle_Label{color:var(--sp-text) !important;font-size:14px !important;}
.DesktopUI .InstallRequestModal .DialogCheckbox{width:20px !important;height:20px !important;min-width:20px !important;margin:0 !important;border-radius:6px !important;border:1.5px solid var(--sp-muted) !important;background:transparent !important;box-shadow:none !important;}
.DesktopUI .InstallRequestModal .DialogCheckbox svg{opacity:0;}
.DesktopUI .InstallRequestModal .DialogCheckbox.Active{background:var(--sp-accent) !important;border-color:var(--sp-accent) !important;}
.DesktopUI .InstallRequestModal .DialogCheckbox.Active svg{opacity:1;}
.DesktopUI .InstallRequestModal .DialogCheckbox.Active svg *{fill:var(--sp-accent-ink) !important;stroke:var(--sp-accent-ink) !important;filter:none !important;}
.DesktopUI .InstallRequestModal .FolderSelector{display:flex !important;flex-direction:column;gap:10px;margin:0 !important;}
.DesktopUI .InstallRequestModal .FolderSelector > .Header{display:flex !important;align-items:center;justify-content:space-between;margin:0 !important;color:var(--sp-muted) !important;font-size:11px !important;font-weight:700 !important;letter-spacing:.08em !important;text-transform:uppercase;}
.DesktopUI .InstallRequestModal .FolderSettings{width:34px !important;height:34px !important;min-width:0 !important;min-height:0 !important;padding:0 !important;display:flex !important;align-items:center;justify-content:center;border-radius:50% !important;corner-shape:round !important;}
.DesktopUI .InstallRequestModal .FolderSettings svg{width:16px !important;height:16px !important;}
.DesktopUI .InstallRequestModal .FolderSettings svg *{fill:var(--sp-muted) !important;}
.DesktopUI .InstallRequestModal .FolderSettings:hover svg *{fill:var(--sp-text) !important;}
.DesktopUI .InstallRequestModal .FolderSelector > div:not(.Header){display:flex !important;flex-direction:column;gap:8px;}
.DesktopUI .InstallRequestModal .FolderOption{display:flex !important;align-items:center;gap:12px;min-height:52px;padding:0 16px !important;margin:0 !important;background:var(--sp-surface2) !important;border:1px solid var(--sp-line) !important;border-radius:var(--sp-r-md) !important;color:var(--sp-text) !important;box-shadow:none !important;cursor:pointer;transition:border-color .15s,background .15s;}
.DesktopUI .InstallRequestModal .FolderOption:hover{border-color:color-mix(in srgb,var(--sp-accent) 55%,var(--sp-line)) !important;}
.DesktopUI .InstallRequestModal .FolderOption.Active{background:color-mix(in srgb,var(--sp-accent) 14%,var(--sp-surface2)) !important;border-color:var(--sp-accent) !important;}
.DesktopUI .InstallRequestModal .FolderOption :is(.FolderFlag,.FolderFlagStar){display:flex;align-items:center;flex:none;}
.DesktopUI .InstallRequestModal .FolderOption :is(.FolderFlag,.FolderFlagStar) svg{width:18px !important;height:18px !important;}
.DesktopUI .InstallRequestModal .FolderOption .FolderFlag svg *{fill:var(--sp-muted) !important;}
.DesktopUI .InstallRequestModal .FolderOption.Active .FolderFlag svg *{fill:var(--sp-accent) !important;}
.DesktopUI .InstallRequestModal .FolderOption .FolderFlagStar svg *{fill:var(--sp-accent) !important;}
.DesktopUI .InstallRequestModal .FolderName{flex:1 1 auto;min-width:0;color:var(--sp-text) !important;font-size:15px !important;font-weight:700 !important;}
.DesktopUI .InstallRequestModal .FolderOption .FreeSpace{flex:none;}
.DesktopUI .InstallRequestModal .NoticeInstallFolder{color:var(--sp-muted) !important;font-size:13px !important;margin:0 !important;}
.DesktopUI .InstallRequestModal .NoticeInstallFolder:not(:has(:not(:empty))){display:none;}
/* Contrat de licence (EULA) demandé avant certaines installations : GenericConfirmDialog + EulaModalDialog (sans GenericDialogBase) */
.DesktopUI .EulaModalDialog{width:min(720px,calc(100vw - 48px)) !important;max-width:none !important;}
.DesktopUI .EulaModalDialog :is(.DialogBodyText,.DialogBody){margin:0 !important;}
.DesktopUI .EulaModalDialog .EulaDialogContent{gap:14px;color:var(--sp-muted) !important;font-size:14px !important;}
.DesktopUI .EulaModalDialog .DialogContent_InnerWidth{max-width:none !important;}
.DesktopUI .EulaModalDialog .EulaIntro{color:var(--sp-muted) !important;font-size:14px !important;line-height:1.5 !important;text-align:left !important;}
.DesktopUI .EulaModalDialog .LanguageFieldContainer{margin:0 !important;color:var(--sp-muted) !important;}
.DesktopUI .EulaModalDialog .LanguageFieldContainer :is(.Field,.FieldLabelRow,.FieldChildrenWithIcon,.FieldChildrenInner){background:transparent !important;border:0 !important;box-shadow:none !important;padding-left:0 !important;padding-right:0 !important;}
.DesktopUI .EulaModalDialog .LanguageFieldContainer .FieldLabel{color:var(--sp-muted) !important;font-size:13px !important;font-weight:600 !important;text-transform:none !important;letter-spacing:0 !important;}
.DesktopUI .EulaModalDialog .DialogDropDown{background:var(--sp-surface2) !important;background-image:none !important;border:1px solid var(--sp-line) !important;border-radius:var(--sp-r-sm) !important;color:var(--sp-text) !important;box-shadow:none !important;}
.DesktopUI .EulaModalDialog .DialogDropDown:hover{border-color:var(--sp-accent) !important;}
.DesktopUI .EulaModalDialog .DialogDropDown_Arrow svg,.DesktopUI .EulaModalDialog .DialogDropDown_Arrow svg *{fill:var(--sp-muted) !important;color:var(--sp-muted) !important;}
.DesktopUI .EulaModalDialog .EULAScrolling{border:1px solid var(--sp-line) !important;border-radius:var(--sp-r-md) !important;box-shadow:none !important;background:var(--sp-bg) !important;overflow-y:auto;}
.DesktopUI .EulaModalDialog .EULAContent{background:transparent !important;border-radius:0 !important;padding:16px 18px !important;color:var(--sp-text) !important;font-size:13px !important;line-height:1.65 !important;}
.DesktopUI .EulaModalDialog .EULAContent *{color:inherit !important;background:transparent !important;font-family:var(--sp-font) !important;}
.DesktopUI .EulaModalDialog .EULAContent :is(h1,h2,h3,h4,b,strong){color:var(--sp-text) !important;}
.DesktopUI .EulaModalDialog .EULAContent a{color:var(--sp-accent) !important;}
.DesktopUI .EulaModalDialog .EULAError{background:var(--sp-surface2) !important;border:1px solid var(--sp-line) !important;border-radius:var(--sp-r-md) !important;color:var(--sp-text) !important;}
.sp-avatar{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;font-weight:800;color:#0a0d12;flex:none;}
.sp-pop{position:fixed;z-index:1000;background:var(--sp-surface);border:1px solid var(--sp-line);border-radius:var(--sp-r-md);box-shadow:0 18px 44px rgba(0,0,0,.55);padding:6px;font-family:var(--sp-font);color:var(--sp-text);font-size:14px;}
.sp-pop-item{display:flex;align-items:center;gap:12px;width:100%;min-height:40px;padding:6px 10px;border:0;border-radius:var(--sp-r-sm);background:transparent;text-align:left;}
.sp-pop-item:hover,.sp-pop-item[aria-checked="true"]{background:var(--sp-surface2);}
.sp-sep{height:1px;background:var(--sp-line);margin:4px 6px;}
.sp-scrim{position:fixed;inset:0;z-index:900;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:32px;}
.sp-dialog{width:100%;max-width:1180px;max-height:100%;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.6);}
/* Fenêtre pilotée à la manette (core/padNav.ts) : élément focalisé bien visible */
.sp-padnav :focus{outline:3px solid var(--sp-accent) !important;outline-offset:3px;box-shadow:var(--sp-glow);}

/* Barre de navigation */
.sp-topnav,.sp-topnav *{box-sizing:border-box;}
.sp-topnav{display:flex;align-items:center;gap:14px;height:100%;padding:0 12px 0 18px;font-family:var(--sp-font);color:var(--sp-text);}
.sp-topnav nav{position:relative;display:flex;gap:2px;}
.sp-topnav nav button{position:relative;height:32px;padding:0 13px;border:0;border-radius:var(--sp-r-sm);background:transparent;color:var(--sp-muted);font-weight:700;font-size:14px;transition:color .2s;}
.sp-topnav nav button:hover{color:var(--sp-text);}
.sp-topnav nav button[aria-current="page"]{color:var(--sp-text);}
/* Mise à jour de Steam Upgraded disponible (onglet Paramètres, entrée « Mises à jour ») */
.sp-update-dot{display:inline-block;width:7px;height:7px;margin-left:6px;vertical-align:2px;border-radius:50%;background:var(--sp-accent);box-shadow:0 0 6px var(--sp-accent);corner-shape:round !important;}
/* Pastille de l'onglet actif (TopNav.tsx) : glisse d'un onglet à l'autre */
.sp-topnav-ind{position:absolute;top:0;left:0;width:0;height:32px;border-radius:var(--sp-r-sm);background:var(--sp-surface2);opacity:0;pointer-events:none;}
.sp-topnav nav.sp-ind-ready .sp-topnav-ind{transition:transform .26s cubic-bezier(.2,.8,.2,1),width .26s cubic-bezier(.2,.8,.2,1),opacity .2s;}
@media (prefers-reduced-motion:reduce){.sp-topnav nav.sp-ind-ready .sp-topnav-ind{transition:opacity .14s;}}
/* Pilule de navigation (fenêtre étroite) : affiche la section en cours, se déploie au survol ou au focus */
.sp-navpill{display:none;position:relative;-webkit-app-region:no-drag;}
.sp-navpill-current{display:flex;align-items:center;gap:8px;height:32px;padding:0 12px 0 14px;border-radius:16px;border:1px solid var(--sp-line);background:var(--sp-surface2);color:var(--sp-text);font-family:var(--sp-font);font-weight:700;font-size:14px;cursor:pointer;-webkit-app-region:no-drag;corner-shape:round !important;}
.sp-navpill-current svg{color:var(--sp-muted);transition:transform .15s;}
.sp-navpill-menu{position:absolute;top:100%;left:0;z-index:1000;padding-top:6px;visibility:hidden;opacity:0;transform:translateY(-4px);transition:opacity .14s,transform .14s,visibility 0s linear .14s;-webkit-app-region:no-drag;}
.sp-navpill-list{min-width:190px;padding:6px;border-radius:var(--sp-r-md);background:var(--sp-surface);border:1px solid var(--sp-line);box-shadow:0 18px 44px rgba(0,0,0,.55);font-family:var(--sp-font);}
.sp-navpill:hover .sp-navpill-menu,.sp-navpill:focus-within .sp-navpill-menu{visibility:visible;opacity:1;transform:none;transition:opacity .14s,transform .14s;}
.sp-navpill:hover .sp-navpill-current,.sp-navpill:focus-within .sp-navpill-current{border-color:var(--sp-accent);}
.sp-navpill:hover .sp-navpill-current svg,.sp-navpill:focus-within .sp-navpill-current svg{transform:rotate(180deg);}
@media (prefers-reduced-motion:reduce){.sp-navpill-menu,.sp-navpill-current svg{transition:none;}}
.sp-arrow{width:32px;height:32px;border:0;border-radius:var(--sp-r-sm);background:transparent;color:var(--sp-muted);display:inline-flex;align-items:center;justify-content:center;}
.sp-arrow:hover{background:var(--sp-surface2);color:var(--sp-text);}
.sp-presence{display:flex;align-items:center;gap:8px;height:32px;padding:0 10px 0 3px;margin:0 4px;border-radius:16px;border:1px solid var(--sp-line);background:var(--sp-surface2);color:var(--sp-text);font-family:var(--sp-font);}
.sp-presence[aria-expanded="true"]{border-color:var(--sp-accent);}
.sp-presence,.sp-presence *{corner-shape:round !important;}

/* Fenêtre « Liste de contacts » (et fenêtres de discussion) aux couleurs du thème */
body.client_chat_frame,.friendlist,.chat_main,.popup_chat_frame{background:var(--sp-bg) !important;font-family:var(--sp-font) !important;}
.friendlist *,.chat_main *{font-family:var(--sp-font) !important;}
.friendlist .titleBarContainer,.friendlist .TitleBar,.friendlist .title-area,.chat_main .chatTitleBar{background:var(--sp-surface) !important;}
.friendlist .statusHeaderGlow{background:transparent !important;box-shadow:none !important;}
.friendlist .socialListTab,.friendlist .friendTab,.friendlist .chatSectionTitle,.friendlist .activeTab{background:var(--sp-surface2) !important;color:var(--sp-text) !important;font-weight:800 !important;letter-spacing:.06em;}
.friendlist .friendListFooter{background:var(--sp-surface) !important;border-top:1px solid var(--sp-line);}
.friendlist .onlineFriends,.friendlist .offlineFriends,.friendlist .groupList,.friendlist .friendsContainer{background:transparent !important;}
.friendlist .friendGroup{border-color:var(--sp-line) !important;}
.friendlist .groupName{color:var(--sp-text) !important;font-weight:700 !important;}
.friendlist .groupCount{color:var(--sp-muted) !important;}
.friendlist .horizontalLine,.friendlist .verticalLine{background:var(--sp-muted) !important;}
.friendlist .friend{border-radius:var(--sp-r-sm);}
.friendlist .friend:hover,.friendlist .friend.hoverParent:hover{background:var(--sp-surface2) !important;}
.friendlist .avatarHolder .avatar,.friendlist .avatarHolder img:not(.avatarFrameImg){border-radius:var(--sp-r-sm) !important;}
.friendlist .DialogButton{background:var(--sp-surface2) !important;color:var(--sp-text) !important;border-radius:var(--sp-r-sm) !important;}
.friendlist .searchIconButton,.friendlist .addFriendButton,.friendlist .friendListButton{color:var(--sp-muted) !important;}
.friendlist .searchIconButton:hover,.friendlist .addFriendButton:hover,.friendlist .friendListButton:hover{color:var(--sp-text) !important;}
/* Boutons de fenêtre des contacts : mêmes ronds colorés que la fenêtre principale */
.friendlist .title-bar-actions.window-controls{flex-direction:row !important;gap:8px;align-items:center;padding:0 10px !important;}
.friendlist .windowControlButton{width:13px !important;height:13px !important;min-width:13px !important;padding:0 !important;margin:0 !important;border-radius:50% !important;display:flex !important;align-items:center;justify-content:center;corner-shape:round !important;}
.friendlist .windowControlButton.closeButton{order:3;background:#ff5f57 !important;}
.friendlist .windowControlButton.minimizeButton{order:1;background:#febc2e !important;}
.friendlist .windowControlButton.maximizeButton,.friendlist .windowControlButton.restoreButton{order:2;background:#28c840 !important;}
.friendlist .windowControlButton svg{display:none !important;}
/* Contacts et discussions (lot 3) : en-tête, profil en carte, avatars ronds, intitulés de section */
.friendlist .chatTitleBar{position:relative;height:44px !important;min-height:44px !important;background:var(--sp-surface) !important;}
.friendlist .chatTitleBar::before{content:"Contacts et discussions";position:absolute;left:16px;top:15px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--sp-muted);pointer-events:none;}
/* macOS : les boutons de fenêtre sont à gauche (ordre et place de macOS) ; le titre passe à droite, en miroir de Windows */
.chatTitleBar.OSX::before{left:auto !important;right:16px;}
/* Liseré de focus natif de Steam (ligne d'1 px en haut des fenêtres actives, bleu de Steam ; .singleWindowFocusBar dans les
   contacts et discussions) : à l'accent du thème, plus fort que la règle « pas de dégradés » des contacts.
   Fenêtre principale : notre liseré (FocusLine) le remplace déjà. */
:root body :is(.title-area-highlight.title-area-highlight.title-area-highlight,.singleWindowFocusBar.singleWindowFocusBar.singleWindowFocusBar){background:linear-gradient(to right,var(--sp-accent),color-mix(in srgb,var(--sp-accent) 70%,transparent)) !important;}
.TopBar .title-area-highlight{display:none !important;}
.friendlist div:has(> .AvatarAndUser){background:var(--sp-surface) !important;padding:2px 14px 14px;}
.friendlist div:has(> .AvatarAndUser) > svg{display:none !important;}
.friendlist .AvatarAndUser{box-sizing:border-box;width:100% !important;margin:0 !important;padding:8px 12px !important;border:1px solid var(--sp-line);border-radius:16px;background:var(--sp-surface2) !important;}
.friendlist .AvatarAndUser .playerName{font-weight:800 !important;color:var(--sp-text) !important;}
.friendlist .avatarHolder .avatar,.friendlist .avatarHolder img:not(.avatarFrameImg){border-radius:50% !important;corner-shape:round !important;}
.friendlist .avatarHolder .avatarStatus,.friendlist .avatarHolder .avatarFrame{display:none !important;}
.friendlist .avatarHolder.online img.avatar{box-shadow:0 0 0 2px var(--sp-bg),0 0 0 4px var(--sp-online);}
.friendlist .avatarHolder.ingame img.avatar{box-shadow:0 0 0 2px var(--sp-bg),0 0 0 4px var(--sp-accent);}
.friendlist .avatarHolder:is(.away,.snooze,.awayOrSnooze) img.avatar{box-shadow:0 0 0 2px var(--sp-bg),0 0 0 4px var(--sp-away);}
.friendlist .DropTarget:has(> .favoriteElement){display:flex !important;flex-wrap:wrap;gap:2px 4px;padding:14px 12px 8px !important;}
.friendlist .DropTarget:has(> .favoriteElement)::before{content:"Favoris";flex-basis:100%;margin:0 6px 4px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--sp-muted);}
.friendlist .favoriteElement .friend{border-radius:14px;}
.friendlist .favoriteElement .playerName{font-size:12px !important;color:var(--sp-muted) !important;font-weight:600 !important;}
.friendlist .socialListTab,.friendlist .friendTab.activeTab{background:transparent !important;border:0 !important;box-shadow:none !important;}
.friendlist .socialListTab .tabLabel{font-size:11px !important;font-weight:700 !important;letter-spacing:.08em;text-transform:uppercase;color:var(--sp-muted) !important;}
.friendlist .groupName{font-size:11px !important;font-weight:700 !important;letter-spacing:.08em;text-transform:uppercase;color:var(--sp-muted) !important;}
.friendlist .groupCount{font-size:11px !important;color:var(--sp-muted) !important;}
.friendlist .groupList .friend{margin:0 8px;border-radius:14px;}
.friendlist .groupList .friend .playerName{font-weight:700 !important;color:var(--sp-text) !important;}
.friendlist .groupList .friend.offline{opacity:.72;}
.friendlist .friend.online :is(.gameName,.richPresenceLabel,.FriendStatusLabel){color:var(--sp-online) !important;}
.friendlist .friend.ingame :is(.gameName,.richPresenceLabel,.FriendStatusLabel){color:var(--sp-accent) !important;}
.friendlist .chatSectionTitle{background:var(--sp-surface) !important;border-top:1px solid var(--sp-line);}
.friendlist .chatSectionTitle .voiceRoomDragBar > div{font-size:11px !important;font-weight:700 !important;letter-spacing:.08em;text-transform:uppercase;color:var(--sp-muted) !important;}
.friendlist .ChatRoomList{color:var(--sp-muted) !important;font-size:12.5px;}
.friendlist .ChatRoomList a{color:var(--sp-accent) !important;}
.friendlist > div:first-child{box-shadow:none !important;background:var(--sp-surface) !important;border-bottom:1px solid var(--sp-line);}
/* Halos et ombres de défilement de Steam (dégradés bleutés) : fond uni du thème */
.friendlist div:not(.avatarHolder):not(.avatarHolder *){background-image:none !important;}
.friendlist .chatSectionTitle .voiceRoomDragBar > div{font-size:0 !important;}
.friendlist .chatSectionTitle .voiceRoomDragBar > div::before{content:"Discussions de groupe";font-size:11px;}
/* Fenêtre de discussion (lot 3) : conversations en colonne, bulles, saisie arrondie */
.popup_chat_frame .multiChatDialog{flex-direction:row !important;background:var(--sp-bg) !important;}
.popup_chat_frame .multiChatDialog *{font-family:var(--sp-font) !important;}
.popup_chat_frame .multiChatDialog > .ChatTabs{flex:none;width:220px;height:auto !important;padding-top:44px;box-sizing:border-box;background:var(--sp-surface) !important;border-right:1px solid var(--sp-line);overflow-y:auto;}
.popup_chat_frame .multiChatDialog .chatTitleBar{position:fixed !important;top:0;left:0;right:0;width:auto !important;height:44px !important;z-index:5;background:var(--sp-surface) !important;border-bottom:1px solid var(--sp-line);}
.popup_chat_frame .multiChatDialog .chatTitleBar::before{content:"Discussions";position:absolute;left:16px;top:15px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--sp-muted);pointer-events:none;}
.popup_chat_frame .multiChatDialog .chatTitleBar .window-controls{flex-direction:row !important;gap:8px;align-items:center;margin:0 6px 0 auto;padding:0 10px !important;}
.popup_chat_frame .multiChatDialog .windowControlButton{width:13px !important;height:13px !important;min-width:13px !important;padding:0 !important;margin:0 !important;border-radius:50% !important;display:flex !important;corner-shape:round !important;}
.popup_chat_frame .multiChatDialog .windowControlButton.closeButton{order:3;background:#ff5f57 !important;}
.popup_chat_frame .multiChatDialog .windowControlButton.minimizeButton{order:1;background:#febc2e !important;}
.popup_chat_frame .multiChatDialog .windowControlButton:is(.maximizeButton,.restoreButton){order:2;background:#28c840 !important;}
.popup_chat_frame .multiChatDialog .windowControlButton > *{display:none !important;}
.popup_chat_frame .multiChatDialog > .chatDialogs{flex:1;min-width:0;height:auto !important;margin-top:44px;background:var(--sp-bg) !important;}
.popup_chat_frame .multiChatDialog .inclient{flex-direction:column !important;height:auto !important;padding:12px 10px;}
.popup_chat_frame .multiChatDialog .inclient > div,.popup_chat_frame .multiChatDialog .chatTabList,.popup_chat_frame .multiChatDialog .chatTabList > div{flex-direction:column !important;height:auto !important;width:100% !important;max-width:none !important;gap:4px;}
.popup_chat_frame .multiChatDialog .ChatTab{width:100% !important;max-width:none !important;height:48px !important;padding:0 8px !important;box-sizing:border-box;border:0 !important;border-radius:14px;background:transparent !important;box-shadow:none !important;}
.popup_chat_frame .multiChatDialog .ChatTab:hover{background:var(--sp-surface2) !important;}
.popup_chat_frame .multiChatDialog .ChatTab.Active{background:var(--sp-surface2) !important;}
.popup_chat_frame .multiChatDialog .ChatTab .ChatTabRow{width:100%;}
.popup_chat_frame .multiChatDialog .ChatTab .playerName{font-weight:700 !important;color:var(--sp-text) !important;}
.popup_chat_frame .multiChatDialog .ChatTab .CloseButton{opacity:.5;}
.popup_chat_frame .multiChatDialog .ChatTab .CloseButton:hover{opacity:1;}
.popup_chat_frame .multiChatDialog .dropTargetBox{display:none !important;}
.popup_chat_frame .multiChatDialog .avatarHolder img.avatar,.popup_chat_frame .multiChatDialog .avatarHolder .avatar{border-radius:50% !important;corner-shape:round !important;}
.popup_chat_frame .multiChatDialog .avatarHolder .avatarStatus,.popup_chat_frame .multiChatDialog .avatarHolder .avatarFrame{display:none !important;}
.popup_chat_frame .multiChatDialog .avatarHolder.online img.avatar{box-shadow:0 0 0 2px var(--sp-surface),0 0 0 3.5px var(--sp-online);}
.popup_chat_frame .multiChatDialog .avatarHolder.ingame img.avatar{box-shadow:0 0 0 2px var(--sp-surface),0 0 0 3.5px var(--sp-accent);}
.popup_chat_frame .multiChatDialog div:not(.avatarHolder):not(.avatarHolder *){background-image:none !important;}
.popup_chat_frame .multiChatDialog .chatWindow,.popup_chat_frame .multiChatDialog .chatBody,.popup_chat_frame .multiChatDialog .chatHistory{background:transparent !important;}
.popup_chat_frame .multiChatDialog .msg.timeDivision{justify-content:center;width:fit-content;margin:10px auto !important;padding:4px 12px !important;border-radius:12px;background:var(--sp-surface2) !important;color:var(--sp-muted) !important;font-size:12px !important;}
.popup_chat_frame .multiChatDialog .msg.timeDivision :is(.horizDivider,.preHorizDivider){display:none !important;}
.popup_chat_frame .multiChatDialog .chatTabSelector{display:none !important;}
.popup_chat_frame .multiChatDialog .ChatMessageBlock{margin:6px 0 !important;}
.popup_chat_frame .multiChatDialog .ChatSpeaker .speakerName{font-weight:800 !important;color:var(--sp-text) !important;}
.popup_chat_frame .multiChatDialog .ChatSpeaker :is(.speakerTimeStamp,.FriendChatTimeStamp),.popup_chat_frame .multiChatDialog .msg .FriendChatTimeStamp{color:var(--sp-muted) !important;}
.popup_chat_frame .multiChatDialog .ChatMessageBlock .msg:not(.timeDivision):not(.serverMsg) > .msgText{display:inline-block;max-width:min(70ch,100%);margin:2px 0;padding:9px 14px;border-radius:18px;background:var(--sp-surface2);color:var(--sp-text) !important;line-height:1.45;box-sizing:border-box;}
.popup_chat_frame .multiChatDialog .ChatMessageBlock .msgText.EmoticonOnly{background:transparent;padding:2px 0;}
/* Vos messages (repérés par features/chatSkin.ts) : bulles à droite, à la couleur d'accent */
.popup_chat_frame .multiChatDialog .ChatMessageBlock.sp-self{display:flex;flex-direction:column;align-items:flex-end;}
.popup_chat_frame .multiChatDialog .ChatMessageBlock.sp-self .ChatSpeaker .speakerAvatar{display:none !important;}
.popup_chat_frame .multiChatDialog .ChatMessageBlock.sp-self .ChatSpeaker .speakerName{color:var(--sp-accent) !important;}
.popup_chat_frame .multiChatDialog .ChatMessageBlock.sp-self .msg{display:flex;justify-content:flex-end;}
.popup_chat_frame .multiChatDialog .ChatMessageBlock.sp-self .msg:not(.timeDivision):not(.serverMsg) > .msgText:not(.EmoticonOnly){background:color-mix(in srgb,var(--sp-accent) 18%,var(--sp-surface2));}
.popup_chat_frame .multiChatDialog .chatEntry{background:var(--sp-bg) !important;padding:10px 14px 14px !important;border:0 !important;box-shadow:none !important;align-items:center;gap:8px;}
.popup_chat_frame .multiChatDialog .chatEntry form{flex:1;align-items:center;padding:2px 4px 2px 6px;border:1px solid var(--sp-line);border-radius:16px;background:var(--sp-surface2) !important;}
.popup_chat_frame .multiChatDialog .chatEntry form:focus-within{border-color:var(--sp-accent);}
.popup_chat_frame .multiChatDialog .chatTextarea{background:transparent !important;border:0 !important;color:var(--sp-text) !important;box-shadow:none !important;}
.popup_chat_frame .multiChatDialog .chatTextarea::placeholder{color:var(--sp-muted) !important;}
.popup_chat_frame .multiChatDialog .chatSubmitButton{background:transparent !important;border:0 !important;border-radius:12px !important;color:var(--sp-muted) !important;box-shadow:none !important;}
.popup_chat_frame .multiChatDialog .chatSubmitButton:hover{background:var(--sp-surface2) !important;color:var(--sp-text) !important;}
.popup_chat_frame .multiChatDialog .chatSubmitButton svg,.popup_chat_frame .multiChatDialog .chatSubmitButton svg *{fill:currentColor !important;}
.popup_chat_frame .multiChatDialog form .chatSubmitButton{width:40px !important;height:40px !important;background:var(--sp-accent) !important;color:var(--sp-accent-ink) !important;border-radius:13px !important;}
.popup_chat_frame .multiChatDialog form .chatSubmitButton.disabled{opacity:.45;}
.popup_chat_frame .multiChatDialog .VoiceToggle{background:transparent !important;border:0 !important;color:var(--sp-muted) !important;}
.popup_chat_frame .multiChatDialog .buttonsContainer,.popup_chat_frame .multiChatDialog .chatEntry > div > div{background:transparent !important;border:0 !important;box-shadow:none !important;}

/* Le bloc des boutons de fenêtre prend sa vraie largeur (Steam le fixait à 99 px, notre pastille débordait sur Big Picture) */
.TopBar > .TitleBar > .WindowControls{width:auto !important;display:flex !important;align-items:center;}
.TopBar > .TitleBar > .WindowControls .title-area{position:relative !important;width:auto !important;inset:auto !important;}

/* Fenêtre étroite : on compacte plutôt que de pousser les boutons hors de la barre (en fin de feuille pour l'emporter) */
@media (max-width:1380px){
.sp-dl{padding:0 !important;width:34px;}
.sp-dl-text{display:none !important;}
.TopBar > .TitleBar .GamepadUIToggle{padding:0 !important;width:34px !important;justify-content:center;}
.TopBar > .TitleBar .GamepadUIToggle::after{content:none;}
.sp-presence > span:nth-child(2){display:none !important;}
}
@media (max-width:1180px){
.TitleBarControls > .tool-tip-source:has(.AnnouncementsButton)::before{content:none;}
.TitleBarControls > .tool-tip-source:has(.AnnouncementsButton){padding-left:4px;}
.sp-topnav{gap:6px;padding-left:8px;}
.sp-topnav nav button{padding:0 9px;}
}
@media (max-width:1060px){
.sp-topnav nav{display:none !important;}
.sp-navpill{display:block;}
.TopBar > .TitleBar > .sp-nav-host{overflow:visible;}
}
@media (max-width:1000px){
.sp-topnav > div:first-child{display:none !important;}
.RootMenuBar > .RootMenuButton:first-child{font-size:0 !important;padding:0 8px !important;}
}
`;
}

/**
 * Sections de la feuille actives seulement quand leur cible existe dans la fenêtre : `/*@sp:<nom> <sonde>*\/ … /*@sp:end*\/`.
 * Sonde : `.Classe` (un élément de cette classe existe) ou `body.Classe` (classe du body). Raison : une règle dont un
 * ancêtre porte `:has()` (`X:has(…) Y`) oblige Chromium à recalculer les styles de tout le document à chaque élément
 * ajouté (mesuré : 60 ms au lieu de 12 pour un simple <span> dans la Bibliothèque, saccades au survol et au défilement).
 * Ces règles ne servent qu'à des fenêtres ou des écrans natifs précis : elles ne pèsent plus sur nos pages.
 */
const SECTION = /\/\*@sp:([\w-]+) ([^*]+)\*\/([\s\S]*?)\/\*@sp:end\*\//g;

function probeMatches(doc: Document, probe: string): boolean {
	if (probe.startsWith('body.')) return !!doc.body?.classList.contains(probe.slice(5));
	if (probe.startsWith('.')) return doc.getElementsByClassName(probe.slice(1)).length > 0;
	return !!doc.querySelector(probe);
}

/** Active ou coupe les sections selon ce que la fenêtre affiche (appelé régulièrement, sondes bon marché). */
export function refreshCssSections(doc: Document | null | undefined) {
	if (!doc?.head) return;
	for (const el of doc.head.querySelectorAll<HTMLStyleElement>('style[data-sp-probe]')) {
		const on = probeMatches(doc, el.dataset.spProbe || '');
		if (el.sheet && el.sheet.disabled === on) el.sheet.disabled = !on;
	}
}

/** Injecte (ou met à jour) la feuille de style dans un document Steam. */
export function applyCss(doc: Document, full: string) {
	if (!doc?.head) return;
	let el = doc.getElementById('sp-theme') as HTMLStyleElement | null;
	if (!el) {
		el = doc.createElement('style');
		el.id = 'sp-theme';
		doc.head.appendChild(el);
		const font = doc.createElement('link');
		font.rel = 'stylesheet';
		font.href = 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap';
		doc.head.appendChild(font);
	}
	const sections: { id: string; probe: string; css: string }[] = [];
	const css = full.replace(SECTION, (_m, id: string, probe: string, body: string) => {
		sections.push({ id, probe: probe.trim(), css: body });
		return '';
	});
	if (el.textContent !== css) el.textContent = css;
	// Sections juste après la feuille principale (même ordre de priorité qu'avant, à peu de chose près)
	let after: Element = el;
	for (const s of sections) {
		let st = doc.getElementById(`sp-theme-${s.id}`) as HTMLStyleElement | null;
		if (!st) {
			st = doc.createElement('style');
			st.id = `sp-theme-${s.id}`;
		}
		if (after.nextElementSibling !== st) after.insertAdjacentElement('afterend', st);
		st.dataset.spProbe = s.probe;
		if (st.textContent !== s.css) st.textContent = s.css;
		after = st;
	}
	refreshCssSections(doc);
}
