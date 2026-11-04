// Styles des écrans Big Picture. Les écrans sont dessinés en 1920 px de large
// puis mis à l'échelle de la fenêtre par le cadre (zoom) : les tailles ci-dessous sont donc des pixels de référence.
// Le focus de la manette est signalé par Steam avec la classe .gpfocus sur l'élément focalisé.
const RAW = `
.spbp-host{height:100%;overflow:hidden;background:var(--sp-bg);}
.spbp{display:flex;flex-direction:column;width:1920px;background:var(--sp-bg);color:var(--sp-text);font-family:var(--sp-font);font-size:20px;line-height:1.3;overflow:hidden;position:relative;}
.spbp *{box-sizing:border-box;}
.spbp-body{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;}
.spbp-body::-webkit-scrollbar{display:none;}

/* Boutons : vrais <button> (DialogButton de Steam), débarrassés de leur habillage d'origine */
.spbp .spbp-btn.DialogButton,.spbp button.spbp-btn{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:14px;height:72px;padding:0 34px;border-radius:22px;border:2px solid var(--sp-line);background:var(--sp-surface2);color:var(--sp-text);font-family:var(--sp-font);font-size:24px;font-weight:700;white-space:nowrap;cursor:pointer;transition:transform .12s,box-shadow .12s,outline-color .12s;outline:0 solid transparent;}
.spbp .spbp-btn--primary.DialogButton,.spbp button.spbp-btn--primary{background:var(--sp-accent);border-color:var(--sp-accent);color:var(--sp-accent-ink);font-weight:800;padding:0 40px;}
.spbp .spbp-btn--glass.DialogButton,.spbp button.spbp-btn--glass{background:rgba(10,12,16,.5);border-color:rgba(255,255,255,.3);color:#fff;}
.spbp .spbp-btn--icon.DialogButton,.spbp button.spbp-btn--icon{width:64px;height:64px;padding:0;border-radius:20px;}
/* variante plus compacte (page d'un album) */
.spbp .spbp-btn--compact.DialogButton{height:60px;padding:0 28px;font-size:20px;}
.spbp .spbp-btn--icon.spbp-btn--compact.DialogButton{width:60px;padding:0;}
.spbp .spbp-btn[disabled]{opacity:.55;}
/* Focus très visible : contour clair décalé + halo d'accent */
.spbp .spbp-btn.gpfocus,.spbp .spbp-btn:focus-visible{outline:4px solid var(--sp-text);outline-offset:5px;box-shadow:var(--spbp-glow);}
.spbp .spbp-btn--glass.gpfocus{border-color:#fff;}

/* En-tête : sections (LB/RB), téléchargement, compte, heure */
.spbp-header{display:flex;align-items:center;gap:28px;padding:28px 64px 0;flex:none;}
.spbp-glyph{display:inline-flex;align-items:center;flex:none;}
.spbp-glyph-img{height:100% !important;width:auto !important;display:block;}
.spbp-glyph-text{display:inline-flex;align-items:center;justify-content:center;padding:0 8px;border-radius:10px;border:2px solid var(--sp-line);color:var(--sp-muted);font-weight:800;font-size:15px;flex:none;}
.spbp-bumper{opacity:.75;}
.spbp-tabs{display:flex;gap:6px;}
.spbp-tab{all:unset;cursor:pointer;padding:12px 26px;border-radius:26px;color:var(--sp-muted);font-weight:700;font-size:24px;}
.spbp-tab[aria-current="page"]{background:var(--sp-text);color:var(--sp-bg);font-weight:800;}
.spbp-chip{display:flex;align-items:center;gap:10px;height:52px;padding:0 20px;border-radius:26px;background:var(--sp-surface2);color:var(--sp-muted);font-size:20px;font-weight:700;}
.spbp-account{display:flex;align-items:center;gap:14px;height:60px;padding:0 24px 0 6px;border-radius:30px;background:var(--sp-surface2);}
.spbp-clock{font-size:28px;font-weight:800;font-variant-numeric:tabular-nums;}
.spbp-avatar{position:relative;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--sp-accent);color:var(--sp-accent-ink);font-weight:800;corner-shape:round !important;}
.spbp-avatar img{width:100%;height:100%;border-radius:50%;object-fit:cover;corner-shape:round !important;}
.spbp-avatar > i{position:absolute;right:-2px;bottom:-2px;width:16px;height:16px;border-radius:50%;border:3px solid var(--sp-surface2);corner-shape:round !important;}

/* Texte d'information placé dans le pied de page de Steam, après « STEAM Menu » (hors zoom : tailles en vw) */
.BasicFooter{position:relative;}
.spbp-footinfo{position:absolute;top:0;bottom:0;left:12.5vw;right:52vw;display:flex;align-items:center;font-family:var(--sp-font);font-size:1.05vw;color:var(--sp-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;}
.spbp-footinfo b{color:var(--sp-text);}

/* Pied de page de Steam (aides des boutons) aux couleurs du thème, uniquement sur nos écrans */
.BasicFooter{background:var(--sp-surface) !important;border-top:1px solid var(--sp-line) !important;font-family:var(--sp-font) !important;}
.BasicFooter *{font-family:var(--sp-font) !important;}

.spbp-label{font-size:16px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--sp-muted);}
.spbp-h2{margin:0;font-size:28px;font-weight:800;}
.spbp-card{padding:26px 28px;border-radius:28px;background:var(--sp-surface);border:1px solid var(--sp-line);display:flex;flex-direction:column;gap:10px;}
.spbp .spbp-card-btn.DialogButton,.spbp button.spbp-card-btn{all:unset;box-sizing:border-box;padding:26px 28px;border-radius:28px;background:var(--sp-surface);border:1px solid var(--sp-line);display:flex;flex-direction:column;gap:10px;color:var(--sp-text);font-family:var(--sp-font);cursor:pointer;outline:3px solid transparent;outline-offset:4px;transition:box-shadow .12s,outline-color .12s;}
.spbp .spbp-card-btn.gpfocus{outline-color:var(--sp-accent);box-shadow:var(--spbp-glow);}
.spbp-bar{height:10px;border-radius:5px;background:var(--sp-surface2);overflow:hidden;}
.spbp-bar > i{display:block;height:100%;border-radius:5px;background:var(--sp-accent);}
.spbp-dot{display:inline-block;flex:none;border-radius:50%;corner-shape:round !important;}

/* Capsules larges (accueil) : focus = contour d'accent + halo, rien sur l'image */
.spbp .spbp-capsule.DialogButton,.spbp button.spbp-capsule{all:unset;box-sizing:border-box;position:relative;display:flex;flex-direction:column;gap:10px;width:300px;flex:none;cursor:pointer;}
.spbp-capsule-img{display:block;width:300px;height:168px;border-radius:24px;background:var(--sp-surface2);object-fit:cover;transition:transform .12s,box-shadow .12s;outline:3px solid transparent;outline-offset:4px;}
.spbp-capsule.gpfocus .spbp-capsule-img{outline-color:var(--sp-accent);box-shadow:var(--spbp-glow);transform:scale(1.04);}
.spbp-capsule-name{font-size:20px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.spbp-capsule-sub{font-size:16px;color:var(--sp-muted);margin-top:-6px;}

/* Tuiles de la bibliothèque : un emplacement réservé garde la grille fixe ; la carte (jaquette + infos) est posée
   par-dessus et, au focus, grandit sur place et déborde sur la rangée suivante. Rien n'est posé sur la jaquette. */
.spbp .spbp-tile.DialogButton,.spbp button.spbp-tile{all:unset;box-sizing:border-box;position:relative;display:flex;flex-direction:column;gap:10px;min-width:0;cursor:pointer;z-index:1;}
.spbp-tile-space{display:block;width:100%;aspect-ratio:2/3;}
.spbp-tile-card{position:absolute;top:0;left:0;right:0;display:flex;flex-direction:column;gap:12px;border-radius:26px;transform-origin:center top;transition:transform .14s,box-shadow .14s;}
.spbp-cover{display:block;width:100%;aspect-ratio:2/3;border-radius:20px;background:var(--sp-surface2);object-fit:cover;}
.spbp-tile-name{font-size:17px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.spbp-tile-more{display:none;}
.spbp .spbp-tile.gpfocus{z-index:5;}
.spbp-tile.gpfocus .spbp-tile-card{top:-10px;left:-10px;right:-10px;padding:10px;background:var(--sp-surface);transform:scale(1.08);outline:3px solid var(--sp-accent);outline-offset:4px;box-shadow:var(--spbp-glow-strong);}
.spbp-tile.gpfocus .spbp-tile-more{display:flex;flex-direction:column;gap:6px;padding:0 4px 4px;}
.spbp-tile-more-name{font-size:20px;font-weight:800;line-height:1.2;}
.spbp-tile-more-sub{font-size:16px;color:var(--sp-muted);display:flex;align-items:center;gap:8px;}
.spbp-tile-play{display:flex;align-items:center;gap:10px;margin-top:4px;font-size:16px;font-weight:700;}


/* Rail des vues (bibliothèque) */
.spbp .spbp-view.DialogButton,.spbp button.spbp-view{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;height:58px;padding:0 22px;border-radius:18px;color:var(--sp-muted);font-size:22px;font-weight:600;cursor:pointer;outline:3px solid transparent;outline-offset:2px;}
.spbp .spbp-view[aria-pressed="true"]{background:var(--sp-surface2);color:var(--sp-text);font-weight:800;}
.spbp .spbp-view.gpfocus{outline-color:var(--sp-accent);color:var(--sp-text);box-shadow:var(--spbp-glow);}

/* Lignes de liste (menu rapide) */
.spbp .spbp-row.DialogButton,.spbp button.spbp-row{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:16px;min-height:64px;padding:0 22px;border-radius:20px;font-size:22px;font-weight:700;color:var(--sp-text);cursor:pointer;outline:3px solid transparent;outline-offset:3px;}
.spbp .spbp-row[aria-checked="true"]{background:var(--sp-surface2);}
.spbp .spbp-row.gpfocus{outline-color:var(--sp-accent);box-shadow:var(--spbp-glow);}
.spbp .spbp-row--card.DialogButton,.spbp button.spbp-row--card{background:var(--spbp-card);font-size:20px;font-weight:600;}

/* Magasin : cartes de la liste de souhaits (rangée) et des promos (grille). Au focus, la carte grandit sur place
   avec un fond, un contour d'accent et un halo ; rien n'est posé sur l'image. */
.spbp .spbp-wish.DialogButton,.spbp button.spbp-wish{all:unset;box-sizing:border-box;width:340px;flex:none;display:flex;flex-direction:column;gap:12px;border-radius:26px;cursor:pointer;transform-origin:center top;transition:transform .14s,box-shadow .14s;outline:3px solid transparent;outline-offset:4px;}
.spbp .spbp-wish.gpfocus{width:360px;padding:10px;margin:-10px;background:var(--sp-surface);outline-color:var(--sp-accent);box-shadow:var(--spbp-glow-strong);transform:scale(1.05);z-index:2;}
.spbp .spbp-deal.DialogButton,.spbp button.spbp-deal{all:unset;box-sizing:border-box;position:relative;display:flex;flex-direction:column;gap:10px;min-width:0;border-radius:26px;cursor:pointer;transform-origin:center top;transition:transform .14s,box-shadow .14s;outline:3px solid transparent;outline-offset:4px;}
.spbp .spbp-deal.gpfocus{padding:10px;margin:-10px;background:var(--sp-surface);outline-color:var(--sp-accent);box-shadow:var(--spbp-glow-strong);transform:scale(1.04);z-index:2;}
.spbp-deal-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.spbp .spbp-pill.DialogButton,.spbp button.spbp-pill{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;height:48px;padding:0 22px;border-radius:24px;border:2px solid var(--sp-line);color:var(--sp-text);font-family:var(--sp-font);font-size:19px;font-weight:600;white-space:nowrap;cursor:pointer;outline:3px solid transparent;outline-offset:4px;}
.spbp .spbp-pill[aria-pressed="true"]{border-color:var(--sp-accent);background:var(--sp-surface2);font-weight:800;}
.spbp .spbp-pill.gpfocus{outline-color:var(--sp-text);box-shadow:var(--spbp-glow);}

/* Page de vente : panneau d'achat sur la bannière, puces, visionneuse des captures */
.spbp-buy{position:relative;width:600px;flex:none;display:flex;flex-direction:column;gap:20px;padding:30px;border-radius:32px;background:color-mix(in srgb,var(--sp-bg) 80%,transparent);border:1px solid rgba(255,255,255,.14);}
.spbp .spbp-chip-btn.DialogButton,.spbp button.spbp-chip-btn{all:unset;box-sizing:border-box;flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:8px;height:60px;padding:0 14px;border-radius:18px;background:var(--sp-surface2);color:var(--sp-text);font-family:var(--sp-font);font-size:18px;font-weight:700;white-space:nowrap;cursor:pointer;outline:3px solid transparent;outline-offset:4px;}
.spbp .spbp-chip-btn.gpfocus{outline-color:var(--sp-text);box-shadow:var(--spbp-glow);}
.spbp .spbp-chip-btn[disabled]{opacity:.6;}
.spbp-chip-info{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:8px;height:60px;padding:0 14px;border-radius:18px;background:var(--sp-surface2);font-size:18px;font-weight:700;}
.spbp-tag{height:40px;padding:0 18px;display:flex;align-items:center;border-radius:20px;background:rgba(10,12,16,.55);border:1px solid rgba(255,255,255,.22);color:#fff;font-size:18px;font-weight:700;}
.spbp-feature{height:34px;padding:0 14px;display:flex;align-items:center;border-radius:17px;background:var(--sp-surface2);font-size:16px;font-weight:700;}
.spbp-media-play{position:absolute;left:50%;top:84px;transform:translate(-50%,-50%);width:64px;height:64px;border-radius:50%;background:rgba(10,12,16,.6);border:2px solid rgba(255,255,255,.6);display:flex;align-items:center;justify-content:center;corner-shape:round !important;}
.spbp-viewer{position:fixed;inset:0 0 var(--spbp-footer) 0;z-index:30;background:rgba(0,0,0,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:40px 72px;pointer-events:none;}
.spbp-viewer img{max-width:100%;max-height:calc(100% - 60px);border-radius:24px;object-fit:contain;}
.spbp-viewer-count{font-size:22px;color:var(--sp-muted);}

/* Fond sombre translucide posé sur une bannière (progression des succès) */
.spbp-glass{background:color-mix(in srgb,var(--sp-bg) 74%,transparent);border:1px solid rgba(255,255,255,.14);}
.spbp-kicker{font-size:18px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.8);}

/* Succès : cartes en grille de deux, l'icône à gauche ; au focus, fond, contour d'accent et halo */
.spbp .spbp-ach.DialogButton,.spbp button.spbp-ach{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:22px;min-width:0;padding:16px 22px 16px 16px;border-radius:26px;border:1px solid var(--sp-line);background:var(--spbp-card);color:var(--sp-text);font-family:var(--sp-font);cursor:pointer;outline:3px solid transparent;outline-offset:3px;transition:box-shadow .12s,outline-color .12s;}
.spbp .spbp-ach.gpfocus{background:var(--sp-surface2);outline-color:var(--sp-accent);box-shadow:var(--spbp-glow);}
.spbp-ach-img{width:84px;height:84px;flex:none;border-radius:18px;background:var(--sp-surface2);object-fit:cover;display:block;}
.spbp-ach--todo .spbp-ach-img{filter:grayscale(1);opacity:.6;}
.spbp-ach-desc{font-size:17px;color:var(--sp-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.spbp-ach.gpfocus .spbp-ach-desc{white-space:normal;}
.spbp-pill-static,.spbp-cat{display:inline-flex;align-items:center;gap:10px;height:52px;padding:0 24px;border-radius:26px;border:2px solid var(--sp-line);color:var(--sp-muted);font-size:20px;font-weight:600;white-space:nowrap;}
.spbp-pill-static[aria-current]{border-color:var(--sp-accent);background:var(--sp-surface2);color:var(--sp-text) !important;font-weight:800;}
.spbp-cat{border:0;font-weight:800;font-size:21px;}
.spbp-cat[aria-current]{background:var(--sp-text) !important;color:var(--sp-bg) !important;}

/* Recherche : champ de Steam (TextField) dans notre pilule */
.spbp-search{flex:1;display:flex;align-items:center;gap:18px;height:80px;padding:0 28px;border-radius:26px;background:var(--sp-surface2);border:2px solid var(--sp-line);color:var(--sp-text);}
.spbp-search:has(.gpfocus),.spbp-search:has(.gpfocuswithin),.spbp-search:focus-within{border-color:var(--sp-accent);box-shadow:var(--spbp-glow);}
.spbp-search > div,.spbp-search [class*="Field"]{flex:1;min-width:0;padding:0 !important;margin:0 !important;background:none !important;border:0 !important;box-shadow:none !important;}
.spbp-search input{width:100% !important;height:72px !important;border:0 !important;background:transparent !important;color:var(--sp-text) !important;font-family:var(--sp-font) !important;font-size:28px !important;font-weight:700 !important;padding:0 !important;outline:none !important;box-shadow:none !important;}
.spbp-search input::placeholder{color:var(--sp-muted);font-weight:600;}
.spbp .spbp-result.DialogButton,.spbp button.spbp-result{all:unset;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;min-width:0;border-radius:24px;cursor:pointer;transform-origin:center top;transition:transform .12s,box-shadow .12s;outline:3px solid transparent;outline-offset:4px;}
.spbp .spbp-result.gpfocus{padding:10px;margin:-10px;background:var(--sp-surface);outline-color:var(--sp-accent);box-shadow:var(--spbp-glow-strong);transform:scale(1.04);z-index:2;}
.spbp-result-img{display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:460/215;border-radius:18px;background:var(--sp-surface2);object-fit:cover;}
.spbp-result-person{font-size:48px;font-weight:800;color:var(--sp-muted);}
.spbp-result-person img{width:110px;height:110px;border-radius:50%;object-fit:cover;corner-shape:round !important;}
.spbp-result-name{font-size:18px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.spbp-result-sub{font-size:15px;color:var(--sp-muted);margin-top:-6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}

/* Téléchargements : bannière du jeu en cours, capsules de la file */
.spbp-dl-hero{position:relative;height:600px;flex:none;background:var(--sp-surface2);display:flex;flex-direction:column;justify-content:space-between;padding:36px 72px 52px;overflow:hidden;}
.spbp-dl-hero--idle{height:420px;}
.spbp-dl-fade{position:absolute;inset:0;background:linear-gradient(to right,rgba(0,0,0,.75) 0%,rgba(0,0,0,0) 70%),linear-gradient(to bottom,rgba(0,0,0,.35) 0%,transparent 30%,transparent 60%,var(--sp-bg) 100%);}
.spbp .spbp-capsule--dl.DialogButton,.spbp button.spbp-capsule--dl{width:340px;}
.spbp-capsule--dl .spbp-capsule-img{width:340px;height:159px;}
.spbp-capsule--done .spbp-capsule-img{opacity:.55;}
.spbp .spbp-empty.DialogButton,.spbp button.spbp-empty{all:unset;box-sizing:border-box;display:flex;align-items:center;height:110px;padding:0 34px;border-radius:26px;border:2px dashed var(--sp-line);color:var(--sp-muted);font-family:var(--sp-font);font-size:22px;outline:3px solid transparent;outline-offset:3px;}
.spbp .spbp-empty.gpfocus{outline-color:var(--sp-accent);}

/* Bandes-son : liste des pistes (halo intérieur, la carte est étroite), boutons ronds du lecteur, barres */
.spbp-tracklist{display:flex;flex-direction:column;gap:2px;padding:8px;border-radius:26px;border:1px solid var(--sp-line);background:var(--spbp-card);}
.spbp .spbp-track.DialogButton,.spbp button.spbp-track{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:20px;width:100%;min-height:56px;padding:0 22px;border-radius:18px;font-family:var(--sp-font);font-size:20px;font-weight:500;color:var(--sp-text);cursor:pointer;outline:2px solid transparent;outline-offset:-2px;transition:background .12s,outline-color .12s;}
.spbp .spbp-track--small.DialogButton{min-height:52px;padding:0 18px;gap:16px;font-size:18px;}
.spbp .spbp-track[aria-current="true"]{background:var(--sp-surface2);color:var(--sp-accent);font-weight:800;}
.spbp .spbp-track.gpfocus{background:var(--sp-surface2);outline-color:var(--sp-accent);box-shadow:var(--spbp-glow-in);font-weight:800;}
.spbp .spbp-track[disabled]{cursor:default;opacity:.6;}
.spbp-track-num{width:34px;flex:none;display:flex;justify-content:flex-end;font-size:.9em;font-weight:700;font-variant-numeric:tabular-nums;color:var(--sp-muted);}
.spbp-track[aria-current="true"] .spbp-track-num{color:var(--sp-accent);}
.spbp-track-name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.spbp-track-dur{flex:none;font-size:.86em;font-weight:500;color:var(--sp-muted);font-variant-numeric:tabular-nums;}
.spbp .spbp-round.DialogButton,.spbp button.spbp-round{all:unset;box-sizing:border-box;flex:none;display:flex;align-items:center;justify-content:center;width:var(--spbp-size,72px);height:var(--spbp-size,72px);border-radius:50%;corner-shape:round;background:var(--sp-surface2);color:var(--sp-text);cursor:pointer;outline:3px solid transparent;outline-offset:5px;transition:outline-color .12s,box-shadow .12s;}
.spbp .spbp-round[aria-pressed="true"]{color:var(--sp-accent);box-shadow:inset 0 0 0 2px var(--sp-accent);}
.spbp .spbp-round--primary.DialogButton{background:var(--sp-accent);color:var(--sp-accent-ink);}
.spbp .spbp-round.gpfocus{outline-color:var(--sp-text);box-shadow:var(--spbp-glow);}
.spbp .spbp-round[aria-pressed="true"].gpfocus{box-shadow:inset 0 0 0 2px var(--sp-accent),var(--spbp-glow);}
.spbp-progress{position:relative;flex:1;height:8px;border-radius:4px;background:var(--sp-line);corner-shape:round;}
.spbp-progress > i{position:absolute;left:0;top:0;bottom:0;border-radius:4px;background:var(--sp-accent);corner-shape:round;}
.spbp-progress > b{position:absolute;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:var(--sp-text);corner-shape:round;}

/* Contacts : cartes (grande pour les contacts en ligne, normale, en ligne pour les autres, liste des discussions) */
.spbp-friend-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:22px;}
.spbp-friend-grid--big{grid-template-columns:repeat(3,minmax(0,1fr));}
.spbp-friend-grid--rows{grid-template-columns:repeat(4,minmax(0,1fr));}
.spbp .spbp-friend.DialogButton,.spbp button.spbp-friend{all:unset;box-sizing:border-box;position:relative;display:flex;flex-direction:column;align-items:center;gap:12px;min-width:0;padding:26px 16px 22px;border-radius:26px;background:var(--spbp-card);border:1px solid var(--sp-line);text-align:center;font-family:var(--sp-font);color:var(--sp-text);cursor:pointer;outline:3px solid transparent;outline-offset:4px;transition:outline-color .12s,box-shadow .12s,background .12s;}
.spbp .spbp-friend.gpfocus{background:var(--sp-surface2);outline-color:var(--sp-accent);box-shadow:var(--spbp-glow);}
.spbp .spbp-friend--big.DialogButton{flex-direction:row;align-items:center;gap:24px;padding:24px;text-align:left;background:var(--sp-surface2);}
.spbp .spbp-friend--row.DialogButton{flex-direction:row;align-items:center;gap:14px;min-height:76px;padding:0 18px;border-radius:22px;text-align:left;}
.spbp .spbp-friend--chat.DialogButton{min-height:78px;background:transparent;border-color:transparent;outline-offset:-2px;}
.spbp .spbp-friend--chat[aria-current="true"]{background:var(--sp-surface2);}
.spbp .spbp-friend--chat.gpfocus{box-shadow:var(--spbp-glow-in);}
.spbp-friend-text{display:flex;flex-direction:column;gap:4px;min-width:0;max-width:100%;}
.spbp-friend-name{font-size:22px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.spbp-friend--big .spbp-friend-name{font-size:30px;}
.spbp-friend--row .spbp-friend-name{font-size:19px;}
.spbp-friend-status{font-size:16px;font-weight:600;color:var(--sp-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.spbp-friend--big .spbp-friend-status{font-size:20px;font-weight:700;}
.spbp-friend--row .spbp-friend-status{font-size:15px;}
.spbp-badge-count{position:absolute;top:14px;right:14px;min-width:30px;height:30px;padding:0 9px;box-sizing:border-box;border-radius:15px;corner-shape:round;background:var(--sp-accent);color:var(--sp-accent-ink);font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;}
.spbp-friend--row .spbp-badge-count{position:static;margin-left:auto;}

/* Discussion : bulles (les vôtres teintées d'accent), séparateur de jour */
.spbp-msg{display:flex;flex-direction:column;align-items:flex-start;gap:6px;align-self:flex-start;max-width:72%;outline:none;}
.spbp-msg--mine{align-self:flex-end;align-items:flex-end;}
.spbp-msg-text{padding:16px 22px;border-radius:24px 24px 24px 8px;background:var(--sp-surface2);border:1px solid var(--sp-line);font-size:21px;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere;outline:2px solid transparent;outline-offset:2px;}
.spbp-msg--mine .spbp-msg-text{border-radius:24px 24px 8px 24px;background:color-mix(in srgb,var(--sp-accent) 18%,transparent);border-color:transparent;}
.spbp-msg.gpfocus .spbp-msg-text{outline-color:var(--sp-accent);}
.spbp-msg-meta{font-size:14px;color:var(--sp-muted);padding:0 8px;}
.spbp-msg--system{align-self:center;max-width:80%;font-size:16px;color:var(--sp-muted);text-align:center;}
.spbp-day{display:flex;align-items:center;gap:18px;margin:6px 0 2px;font-size:15px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--sp-muted);}
.spbp-day::before,.spbp-day::after{content:"";flex:1;height:1px;background:var(--sp-line);}

/* Magasin : accès à la liste de souhaits et au panier, lignes du panier */
.spbp .spbp-storelink.DialogButton,.spbp button.spbp-storelink{all:unset;box-sizing:border-box;flex:1;display:flex;align-items:center;gap:16px;min-height:58px;padding:0 22px;border-radius:24px;border:2px solid var(--sp-line);background:var(--sp-surface2);color:var(--sp-text);font-family:var(--sp-font);font-size:23px;font-weight:800;white-space:nowrap;cursor:pointer;outline:3px solid transparent;outline-offset:4px;}
.spbp .spbp-storelink.gpfocus{outline-color:var(--sp-accent);box-shadow:var(--spbp-glow);}
.spbp-count{min-width:38px;height:32px;padding:0 10px;border-radius:16px;background:var(--sp-bg);color:var(--sp-text);font-size:18px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;}
.spbp-count--strong{background:var(--sp-accent);color:var(--sp-accent-ink);}
.spbp .spbp-cartline.DialogButton,.spbp button.spbp-cartline{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:26px;padding:14px 24px 14px 14px;border-radius:26px;border:2px solid var(--sp-line);background:var(--sp-surface);color:var(--sp-text);font-family:var(--sp-font);cursor:pointer;outline:3px solid transparent;outline-offset:3px;}
.spbp .spbp-cartline.gpfocus{border-color:transparent;outline-color:var(--sp-accent);box-shadow:var(--spbp-glow-strong);}
.spbp-cart-tag{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 12px;border-radius:10px;font-size:17px;font-weight:700;}

@media (prefers-reduced-motion:reduce){.spbp *{transition:none !important;}}
`;

// Les boutons de Steam (DialogButton) ont des règles très spécifiques (button.x.DialogButton:enabled…) :
// les nôtres passent en !important pour l'emporter.
const BUTTON_CLASSES = /spbp-(btn|capsule|tile|view|row|wish|deal|pill|chip-btn|card-btn|ach|result|empty|track|round|friend|storelink|cartline)\b/;

export const BP_CSS = RAW.replace(/([^{}]+)\{([^{}]*)\}/g, (rule, sel: string, body: string) => {
	if (!BUTTON_CLASSES.test(sel) || sel.trim().startsWith('@')) return rule;
	const decls = body
		.split(';')
		.map((d) => d.trim())
		.filter(Boolean)
		.map((d) => (d.includes('!important') ? d : `${d} !important`));
	return `${sel}{${decls.join(';')};}`;
});
