"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.webmanifest"), "utf8"));
const themes = ["light", "night", "forest", "bordeaux"];
const fonts = ["red-hat", "roboto", "roboto-slab", "system"];
const requiredTokens = [
  "--paper",
  "--soft",
  "--line",
  "--taupe",
  "--taupe-light",
  "--taupe-dark",
  "--ink",
  "--muted",
  "--topbar-bg",
  "--topbar-fg",
  "--panel-bg",
  "--accent",
  "--accent-ink",
  "--contrast",
  "--contrast-ink",
  "--action",
  "--action-ink",
  "--surface",
  "--surface-raised",
  "--surface-soft"
];

assert.match(app, /const RELEASE_VERSION = "5\.3\.1";/, "L’écran de nouveautés doit suivre la version livrée");
assert.match(app, /RELEASE_NOTES_SEEN_KEY[\s\S]*?showReleaseNotesOnce\(\)/, "L’écran de nouveautés doit mémoriser la version déjà présentée");
assert.equal((html.match(/id="releaseNotesLayer"/g) || []).length, 1, "L’écran de nouveautés doit être unique");
assert.match(html, /Mise à jour 5\.3\.1[\s\S]*?Quoi de neuf/, "L’écran de nouveautés doit annoncer clairement la version");
const releaseNotesList = html.match(/<ul class="release-notes-list">([\s\S]*?)<\/ul>/)?.[1] || "";
assert.equal((releaseNotesList.match(/<li>/g) || []).length, 3, "L’écran de nouveautés doit rester limité à trois informations");
assert.match(html, /<strong>Soins<\/strong>[\s\S]*?<strong>Devis<\/strong>[\s\S]*?<strong>Ajouter<\/strong>/, "Les nouveautés doivent annoncer les libellés courts de la version 5.3.1");
assert.match(html, /<symbol id="icon-swipe-left"/, "Le pictogramme du balayage tactile doit rester disponible");
assert.match(html, /id="familyNavTitle">Soins<[\s\S]*?id="checkoutTitle">Devis</, "Les deux zones principales doivent utiliser des noms courts");
assert.match(html, /id="customItemTitle">Sur mesure<[\s\S]*?<span>Nom<\/span>[\s\S]*?>Ajouter<\/button>/, "Le formulaire libre doit rester ultra court");
assert.doesNotMatch(html, />\s*(?:Prestations|Caisse|Ajouter à la caisse)\s*</, "Les anciens libellés longs ne doivent plus être visibles");
assert.match(app, /catalogOverrides: sanitizeCatalogOverrides/, "Les personnalisations du catalogue doivent être restaurées de façon sûre");

function themeToken(block, token) {
  return block.match(new RegExp(`${token}:(#[0-9a-f]{6})`, "i"))?.[1];
}

function luminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((channel) => parseInt(channel, 16) / 255);
  const linear = channels.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return (linear[0] * 0.2126) + (linear[1] * 0.7152) + (linear[2] * 0.0722);
}

function contrast(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

assert.match(
  app,
  /const KNOWN_THEMES = \["light", "night", "forest", "bordeaux"\]/,
  "La liste applicative doit exposer les quatre thèmes"
);
assert.match(
  app,
  /const KNOWN_FONTS = \["red-hat", "roboto", "roboto-slab", "system"\]/,
  "La liste applicative doit rester limitée aux quatre polices prévues"
);
assert.match(app, /fontFamily: "red-hat"/, "Red Hat Display doit rester la police par défaut");

for (const theme of themes) {
  const themeBlock = html.match(new RegExp(`html\\[data-theme="${theme}"\\]\\{([\\s\\S]*?)\\n  \\}`));
  assert.ok(themeBlock, `Variables CSS absentes pour le thème ${theme}`);
  for (const token of requiredTokens) {
    assert.match(themeBlock[1], new RegExp(`${token}:`), `${token} absent du thème ${theme}`);
  }
  for (const [foreground, background] of [
    ["--topbar-fg", "--topbar-bg"],
    ["--topbar-fg", "--panel-bg"],
    ["--accent-ink", "--accent"],
    ["--contrast-ink", "--contrast"],
    ["--action-ink", "--action"],
    ["--ink", "--paper"],
    ["--ink", "--surface-raised"],
    ["--muted", "--surface-raised"],
    ["--muted", "--surface-soft"],
    ["--taupe-dark", "--taupe-light"]
  ]) {
    const foregroundColor = themeToken(themeBlock[1], foreground);
    const backgroundColor = themeToken(themeBlock[1], background);
    assert.ok(foregroundColor && backgroundColor, `Couleurs de contraste absentes pour ${theme}: ${foreground}/${background}`);
    assert.ok(
      contrast(foregroundColor, backgroundColor) >= 4.5,
      `Contraste insuffisant pour ${theme}: ${foreground}/${background}`
    );
  }
  assert.match(html, new RegExp(`data-theme="${theme}" role="radio"`), `Carte de sélection absente pour ${theme}`);
  assert.match(html, new RegExp(`theme-card-swatch ${theme}`), `Aperçu de palette absent pour ${theme}`);
  const browserColor = app.match(new RegExp(`${theme}: "(#[0-9a-f]{6})"`, "i"))?.[1];
  assert.equal(browserColor, themeToken(themeBlock[1], "--topbar-bg"), `Couleur de fenêtre incohérente pour ${theme}`);
  for (const [selector, property, token] of [
    [`\\.theme-card-swatch\\.${theme}`, "background", "--paper"],
    [`\\.theme-card-swatch\\.${theme} \\.ts-top`, "background", "--topbar-bg"],
    [`\\.theme-card-swatch\\.${theme} \\.ts-panel`, "background", "--panel-bg"],
    [`\\.theme-card-swatch\\.${theme} \\.ts-accent`, "background", "--accent"]
  ]) {
    const previewColor = html.match(new RegExp(`${selector}\\{[^}]*${property}:(#[0-9a-f]{6})`, "i"))?.[1];
    assert.equal(previewColor, themeToken(themeBlock[1], token), `Aperçu ${token} incohérent pour ${theme}`);
  }
}

assert.match(
  html,
  /\.theme-picker\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/,
  "Le sélecteur desktop doit présenter les quatre palettes"
);
assert.match(
  html,
  /@media\(max-width:760px\)\{\.theme-picker\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/,
  "Le sélecteur doit rester compact sur tablette"
);
assert.match(html, /id="fontPicker" role="radiogroup" aria-label="Choix de la police"/);
assert.equal((html.match(/class="font-card"/g) || []).length, 4, "Les réglages doivent proposer exactement quatre polices");
for (const font of fonts) {
  assert.match(html, new RegExp(`data-font="${font}" role="radio"`), `Choix de police absent : ${font}`);
  assert.match(styles, new RegExp(`html\\[data-font="${font}"\\]`), `Variables typographiques absentes : ${font}`);
}
assert.match(styles, /@font-face\{font-family:"Roboto";[^}]*roboto-latin\.woff2/);
assert.match(styles, /@font-face\{font-family:"Roboto Slab";[^}]*roboto-slab-latin\.woff2/);
assert.match(styles, /\.print-quote\{[\s\S]*?font-family:var\(--document-font\)/, "Le PDF doit suivre la police choisie");
assert.doesNotMatch(
  styles,
  /@media print\{[\s\S]*?font-family:"Red Hat Display"/,
  "Aucune zone du PDF ne doit forcer Red Hat Display après un changement"
);
assert.match(
  styles,
  /@media print\{[\s\S]*?html\[data-theme\] body,[\s\S]*?background:#fff!important;[\s\S]*?color-scheme:light!important/,
  "Le thème sombre ne doit jamais colorer les marges physiques du PDF"
);
assert.equal(manifest.background_color, "#f4f1eb", "Le lancement PWA doit reprendre le papier du thème Lumière");
assert.equal(manifest.theme_color, "#171512", "Le lancement PWA doit reprendre l’en-tête du thème Lumière");
assert.doesNotMatch(html, /id="headerLogo"/, "Le logo ne doit plus occuper l’en-tête de l’application");
assert.doesNotMatch(html, /class="brand-logo"/, "Le header doit réserver sa largeur au tarif et aux actions");
assert.match(
  html,
  /<symbol id="icon-student"[^>]*data-design="graduation-v1"[\s\S]*?m3 8\.5 9-4\.5 9 4\.5-9 4\.5-9-4\.5Z/,
  "Le tarif Étudiant doit utiliser un pictogramme de diplôme explicite"
);
assert.match(html, /<h2 id="settingsTitle">Personnalisation<\/h2>/, "La modale doit avoir un titre unique et direct");
assert.doesNotMatch(
  html,
  /<h2[^>]*>Réglages du document|settings-modal-intro">|<h3>Tarification commerciale|<h3>Application et système/,
  "La modale ne doit pas répéter son contenu dans des titres ou introductions longs"
);
assert.doesNotMatch(
  html,
  /<div class="settings-section-head">(?:<div>)?<h3>[^<]+<\/h3><p>/,
  "Les titres de section ne doivent pas être doublés par une phrase descriptive"
);
assert.deepEqual(
  [...html.matchAll(/<div class="settings-section-head"><h3>([^<]+)<\/h3><\/div>/g)].map((match) => match[1]),
  ["Apparence", "Navigation", "iPad", "Démarrage", "Catalogue", "Coordonnées", "Logos", "Numérotation", "TVA", "Offres", "Mentions"],
  "Les sections de Personnalisation doivent garder des titres courts et distincts"
);
assert.match(app, /ipadLayoutMode: "off"/, "L’optimisation iPad doit être désactivée par défaut");
assert.match(app, /const preference = IPAD_LAYOUT_MODES\.includes\(mode\) \? mode : "off"/, "Une valeur iPad invalide doit conserver le rendu standard");
assert.equal((html.match(/name="ipadLayoutMode" type="radio"/g) || []).length, 3, "Le réglage iPad doit proposer Automatique, Toujours et Désactivée");
assert.match(html, /value="auto"[\s\S]*?value="always"[\s\S]*?value="off"/, "Les trois modes iPad doivent rester explicites et ordonnés");
assert.match(app, /function isLikelyIpad\(\)[\s\S]*?navigator\.maxTouchPoints/, "iPadOS en mode bureau doit être reconnu sans dépendre uniquement du user-agent");
assert.match(app, /document\.documentElement\.dataset\.ipadLayout = optimized \? "optimized" : "standard"/, "Le choix iPad doit piloter un état de rendu unique");
assert.match(html, /html\[data-ipad-layout="optimized"\][\s\S]*?touch-action:manipulation/, "Le mode iPad doit supprimer le délai des interactions tactiles");
assert.match(html, /html\[data-ipad-layout="optimized"\] input,[\s\S]*?font-size:16px/, "Les champs iPad doivent éviter le zoom automatique de Safari");
assert.match(
  html,
  /name="showTaxInformation" type="checkbox"[\s\S]*?<strong>Afficher et calculer la TVA<\/strong>[\s\S]*?les prix sont conservés tels quels/,
  "Le réglage TVA doit expliquer que sa désactivation conserve les prix existants"
);
assert.equal((html.match(/class="settings-toggle-card full-field"/g) || []).length, 2, "TVA et signatures doivent partager le même contrôle premium");
assert.match(html, /id="icon-percent"[\s\S]*?id="icon-signature"/, "Les deux réglages doivent utiliser des pictogrammes explicites");
assert.match(html, /name="showSignatures" type="checkbox"[\s\S]*?<strong>Zones de signature<\/strong>[\s\S]*?Date et lieu/, "Le réglage des signatures doit expliquer son effet sur le devis");
assert.doesNotMatch(html, /class="checkbox-field full-field"><input[^>]*name="(?:showTaxInformation|showSignatures)"/, "Les deux réglages ne doivent plus ressembler à des cases à cocher génériques");
assert.match(html, /\.settings-toggle-card:has\(\.settings-toggle-input:checked\)/, "La carte doit rendre son état actif immédiatement visible");
assert.match(html, /\.settings-toggle-card:has\(\.settings-toggle-input:focus-visible\)/, "Le nouveau contrôle doit conserver un focus clavier visible");
assert.match(app, /showTaxInformation: false/, "La TVA doit être masquée et désactivée par défaut");
assert.match(
  app,
  /function calculateQuote\(item\)[\s\S]*?tax: \{ \.\.\.\(item\?\.tax \|\| \{\}\), enabled: false \}/,
  "Les totaux sans TVA doivent conserver les prix sans appliquer de conversion fiscale"
);
assert.match(
  app,
  /taxToggle\.closest\("\.tax-header-toggle"\)\.hidden = !showTaxInformation/,
  "Le réglage global doit retirer le contrôle TVA de la caisse"
);
assert.match(
  app,
  /<tr><td>Total avant offres<\/td>[\s\S]*?<td>Rabais total<\/td>[\s\S]*?Total à payer/,
  "Le PDF doit reprendre le même récapitulatif commercial que la caisse"
);
assert.match(
  html,
  /data-settings-panel="interface"[\s\S]*?<h3>Catalogue<\/h3>[\s\S]*?data-settings-panel="company"/,
  "Le catalogue doit rester avec les réglages d’interface"
);
assert.doesNotMatch(
  html,
  /data-settings-panel="document"[\s\S]*?<h3>Catalogue<\/h3>/,
  "Le panneau Devis ne doit contenir que les réglages du document"
);
assert.match(app, /single: \{ top: "Séance unique", hint: "Séance", fullHint: "Prix par séance" \}/, "Le tarif actif doit rester court avec son libellé complet au survol");
assert.match(app, /activeOfferHint\.title = content\.fullHint/, "Le libellé complet du tarif doit rester accessible au survol");
assert.equal((html.match(/data-settings-tab="/g) || []).length, 4, "Personnalisation doit proposer quatre groupes");
assert.equal((html.match(/data-settings-panel="/g) || []).length, 4, "Chaque groupe doit avoir un panneau dédié");
assert.match(
  html,
  /\.settings-panel\[hidden\]\{display:none!important\}/,
  "Un seul groupe de réglages doit être affiché à la fois"
);
assert.doesNotMatch(
  html,
  /class="(?:theme|font)-card-copy"><strong>[^<]+<\/strong><small>/,
  "Les aperçus de thème et de police ne doivent pas répéter leur rendu dans une description"
);
assert.doesNotMatch(
  app,
  /1 séance gratuite pour|Le client paie|Aucune famille sélectionnée/,
  "Les résumés dynamiques de Personnalisation doivent rester concis"
);
assert.match(
  html,
  /<symbol id="icon-navigation-tiles"[^>]*data-design="app-navigation-v2"[\s\S]*?class="navigation-preview-row navigation-preview-row-active"/,
  "La navigation Tuiles doit représenter les familles actuelles en accordéon"
);
assert.match(
  html,
  /<symbol id="icon-navigation-body"[^>]*data-design="app-navigation-v2"[\s\S]*?<use href="#bodymap-full"/,
  "La navigation corporelle doit reprendre le système anatomique actuel"
);
assert.match(
  html,
  /value="tiles"[\s\S]*?<use href="#icon-navigation-tiles"[\s\S]*?value="body"[\s\S]*?<use href="#icon-navigation-body"/,
  "Les deux choix de Navigation doivent utiliser leurs aperçus SVG dédiés"
);
assert.doesNotMatch(
  html,
  /catalog-mode-visual tiles|catalog-mode-visual body|<use href="#icon-body"><\/use>/,
  "Les anciens aperçus génériques de Navigation ne doivent plus être utilisés"
);
assert.match(
  html,
  /html\[data-theme\] \.local-badge>span\{background:var\(--accent\)/,
  "L’indicateur local doit suivre l’accent de chaque thème"
);
assert.match(
  html,
  /html\[data-theme\] \.button\.primary,[\s\S]*?background:var\(--action\)/,
  "Les actions principales doivent utiliser la couleur d’action de chaque thème"
);
assert.match(
  html,
  /html\[data-theme\] \.button\.primary\{color:var\(--action-ink\)\}/,
  "Le libellé des actions principales doit rester lisible dans chaque thème"
);
assert.match(
  styles,
  /html\[data-theme\] \.cart-line-inline-controls \.quantity-stepper\{[\s\S]*?background:var\(--surface-raised\)/,
  "Les contrôles de quantité doivent rester lisibles dans les quatre thèmes"
);
assert.match(
  styles,
  /html\[data-ipad-layout="optimized"\] \.cart-line-inline-controls \.quantity-stepper\{min-height:40px;grid-template-columns:34px minmax\(28px,auto\) 34px\}/,
  "Le mode iPad doit conserver des boutons de quantité tactiles"
);
assert.match(styles, /\.cart-line-main\{[^}]*touch-action:pan-y/, "La ligne de caisse doit conserver le défilement vertical pendant un geste tactile");
assert.match(styles, /\.cart-line\.is-delete-revealed\{--cart-line-swipe-offset:-56px\}/, "Le balayage gauche doit dégager la zone de suppression");
assert.match(styles, /@media \(hover:hover\) and \(pointer:fine\)\{[\s\S]*?\.cart-line-delete-zone:hover \.remove-line/, "La poubelle doit apparaître au bord droit avec une souris");
assert.match(app, /CART_DELETE_REVEAL_WIDTH = 56[\s\S]*?pointerType[\s\S]*?"touch", "pen"/, "La caisse doit gérer le balayage tactile et le stylet");
assert.match(app, /cart-line-delete-zone[\s\S]*?data-line-action="remove"[\s\S]*?cart-line-main[\s\S]*?cart-line-inline-controls/, "La poubelle doit être rendue hors des contrôles de quantité");
assert.match(app, /decreaseAction: "decrease"[\s\S]*?increaseAction: "increase"/, "La quantité payée doit proposer des contrôles −/+ explicites");
assert.match(app, /decreaseAction: "decrease-free"[\s\S]*?increaseAction: "increase-free"/, "La quantité offerte doit proposer des contrôles −/+ explicites");
assert.doesNotMatch(app, /data-quantity-gesture|contextmenu[\s\S]*?changeQuantityFromGesture/, "Les quantités ne doivent plus dépendre du clic droit");
assert.match(
  styles,
  /html\[data-theme\] \.body-map-card,[\s\S]*?background:color-mix\(in srgb,var\(--panel-bg\)/,
  "Le sélecteur corporel doit reprendre la surface sombre de chaque palette"
);
assert.match(
  styles,
  /html\[data-theme\] \.body-side-toggle,[\s\S]*?html\[data-theme\] \.body-model-toggle\{[\s\S]*?background:color-mix\(in srgb,var\(--panel-bg\)/,
  "Les sélecteurs Femme/Homme et Face/Dos doivent suivre la surface de chaque palette"
);
assert.match(
  styles,
  /html\[data-theme\] \.checkout-transmission-menu\{[\s\S]*?background:var\(--surface-raised\)/,
  "Le menu d’envoi doit suivre la surface du thème actif"
);
assert.match(
  styles,
  /html\[data-theme\]\.bcdevis-window-overlay \.window-controls button\{[\s\S]*?var\(--topbar-fg\)/,
  "Les contrôles de fenêtre doivent rester cohérents avec l’en-tête actif"
);

console.log("THEME_CONTRACTS_TESTS_OK");
