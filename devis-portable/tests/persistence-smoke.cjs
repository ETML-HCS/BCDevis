"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const TEST_ENV = "BCDEVIS_DESKTOP_PERSISTENCE_SMOKE";

if (process.env[TEST_ENV] !== "1") {
  const electron = require("electron");
  const environment = { ...process.env, [TEST_ENV]: "1" };
  delete environment.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(electron, [__filename], {
    cwd: path.resolve(__dirname, "..", ".."),
    env: environment,
    encoding: "utf8",
    timeout: 60000
  });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.error) throw result.error;
  assert.equal(result.status, 0, "Le test de persistance Electron a échoué");
  console.log("DESKTOP_PERSISTENCE_SMOKE_OK");
  process.exit(0);
}

const { app, BrowserWindow } = require("electron");
const profileDirectory = path.join(os.tmpdir(), `bcdevis-smoke-${process.pid}-${Date.now()}`);

function reload(webContents) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Rechargement de l'application trop long")), 15000);
    webContents.once("did-finish-load", () => {
      clearTimeout(timeout);
      resolve();
    });
    webContents.reload();
  });
}

async function run() {
  app.setPath("userData", profileDirectory);
  app.commandLine.appendSwitch("disable-gpu");
  await app.whenReady();
  const window = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });

  try {
    await window.loadFile(path.resolve(__dirname, "..", "index.html"), { query: { windowShell: "custom" } });
    const initial = await window.webContents.executeJavaScript(`(async () => {
      const noTransitions = document.createElement("style");
      noTransitions.textContent = "*{transition:none!important}";
      document.head.append(noTransitions);
      const releaseLayer = document.querySelector("#releaseNotesLayer");
      if (!releaseLayer || releaseLayer.hidden) throw new Error("L’écran des nouveautés 6.0.0 ne s’ouvre pas au premier lancement");
      if (localStorage.getItem("bcdevis-release-notes-last-seen") !== "6.0.0") throw new Error("La version présentée n’est pas mémorisée");
      if (!document.querySelector("#appShell").inert) throw new Error("L’application reste interactive derrière l’écran des nouveautés");
      const releaseRect = releaseLayer.querySelector(".release-notes-modal").getBoundingClientRect();
      if (releaseRect.left < 0 || releaseRect.right > innerWidth + 1 || releaseRect.top < 0 || releaseRect.bottom > innerHeight + 1) throw new Error("L’écran des nouveautés déborde de la fenêtre");
      await new Promise((resolve) => setTimeout(resolve, 70));
      const releaseButton = releaseLayer.querySelector("[data-initial-focus]");
      if (document.activeElement !== releaseButton) throw new Error("Le bouton principal des nouveautés ne reçoit pas le focus initial");
      releaseButton.click();
      if (!releaseLayer.hidden || document.querySelector("#appShell").inert) throw new Error("L’écran des nouveautés ne se ferme pas proprement");
      window.bcdevisDesktop = {
        savePdf: async (fileName) => ({ saved: true, fileName, filePath: "C:/Downloads/" + fileName }),
        composeEmail: async () => ({ opened: true, attached: true, client: "test" }),
        openExternal: async () => true
      };
      const normalizedColor = (value) => {
        const probe = document.createElement("span");
        probe.style.color = value;
        document.body.append(probe);
        const result = getComputedStyle(probe).color;
        probe.remove();
        return result;
      };
      document.querySelector("#settingsButton").click();
      const catalogEditorButton = document.querySelector("#tileCatalogEditorButton");
      catalogEditorButton.click();
      const catalogEditorLayer = document.querySelector("#tileCatalogEditorLayer");
      const beardEditorCard = catalogEditorLayer.querySelector('[data-tile-editor-card][data-service-id="27"]');
      if (catalogEditorLayer.hidden || !beardEditorCard || catalogEditorLayer.querySelectorAll("[data-tile-editor-card]").length < 80) throw new Error("L’éditeur du catalogue ne charge pas toutes les tuiles");
      const beardIconButton = beardEditorCard.querySelector("[data-tile-icon-picker]");
      beardIconButton.click();
      await new Promise((resolve) => setTimeout(resolve, 70));
      const iconPickerLayer = document.querySelector("#tileIconPickerLayer");
      const alternateIcon = [...iconPickerLayer.querySelectorAll("[data-tile-icon-choice]")].find((button) => button.getAttribute("aria-pressed") === "false");
      if (iconPickerLayer.hidden || !alternateIcon) throw new Error("La bibliothèque SVG du catalogue ne s’ouvre pas");
      const selectedCatalogIcon = alternateIcon.dataset.tileIconChoice;
      alternateIcon.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (!iconPickerLayer.hidden || document.activeElement !== beardIconButton) throw new Error("Le choix d’un SVG ne revient pas sur la tuile éditée");
      beardEditorCard.querySelector('[data-tile-field="name"]').value = "Barbe personnalisée";
      beardEditorCard.querySelector('[data-tile-field="duration"]').value = "40";
      beardEditorCard.querySelector('[data-tile-field="price"]').value = "230";
      beardEditorCard.querySelector('[data-tile-field="name"]').dispatchEvent(new Event("input", { bubbles: true }));
      document.querySelector("#tileCatalogEditorForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
      const savedCatalogOverride = JSON.parse(localStorage.getItem("bcdevis-v1")).catalogOverrides?.["27"];
      if (!catalogEditorLayer.hidden || document.querySelector("#settingsLayer").hidden || document.activeElement !== catalogEditorButton) throw new Error("L’éditeur du catalogue ne revient pas correctement aux réglages");
      if (savedCatalogOverride?.name !== "Barbe personnalisée" || savedCatalogOverride?.duration !== 40 || savedCatalogOverride?.price !== 230 || savedCatalogOverride?.icon !== selectedCatalogIcon) throw new Error("La personnalisation d’une tuile n’est pas sauvegardée");
      document.querySelector('#settingsLayer [data-close="settingsLayer"]').click();
      const customizedBeardTile = document.querySelector('[data-family-service-id="27"]');
      if (customizedBeardTile?.querySelector(".family-option-copy strong")?.textContent !== "Barbe personnalisée") throw new Error("La tuile personnalisée n’est pas appliquée au catalogue");
      if (!document.querySelector("#checkoutPanel").classList.contains("is-full-height")) throw new Error("La caisse doit rester en plein écran sur ordinateur");
      if (!document.documentElement.classList.contains("checkout-focus")) throw new Error("Le mode caisse permanent n’est pas initialisé");
      if (document.querySelector("#checkoutFocusToggle") || document.querySelector("#familyFooter") || document.querySelector(".checkout-actions")) throw new Error("Les anciens bandeaux d’actions doivent être supprimés");
      const checkoutActions = [...document.querySelectorAll(".checkout-primary-actions > button")];
      if (checkoutActions.length !== 4) throw new Error("Le devis doit conserver exactement quatre actions rapides");
      const checkoutActionRects = checkoutActions.map((button) => button.getBoundingClientRect());
      if (checkoutActions.some((button) => button.textContent.trim() || button.querySelectorAll(":scope > svg").length !== 1 || !button.dataset.tooltip)) throw new Error("Les sorties du devis doivent rester des SVG seuls avec info-bulle");
      if (checkoutActionRects.some((rect) => rect.width < 48 || rect.height < 48) || Math.max(...checkoutActionRects.map((rect) => rect.width)) - Math.min(...checkoutActionRects.map((rect) => rect.width)) > 1) throw new Error("Les sorties SVG ne conservent pas des cibles équilibrées");
      const checkoutRect = document.querySelector("#checkoutPanel").getBoundingClientRect();
      if (Math.abs(checkoutRect.top) > 1 || Math.abs(checkoutRect.bottom - innerHeight) > 1) throw new Error("La caisse n’occupe pas toute la hauteur de la fenêtre");
      const checkoutStyle = getComputedStyle(document.querySelector("#checkoutPanel"));
      const cartStyle = getComputedStyle(document.querySelector(".cart-section"));
      if (checkoutStyle.animationName !== "none") throw new Error("La caisse permanente ne doit plus s’animer comme un panneau temporaire");
      if (Number(cartStyle.flexGrow) < 1 || cartStyle.maxHeight !== "none") throw new Error("La liste de la caisse n’utilise pas la hauteur disponible");
      if (document.querySelector("#quoteNumber, .quote-number")) throw new Error("Le numéro de devis encombre encore l’en-tête de caisse");
      const quoteHeaderButtons = [...document.querySelectorAll("#quoteHeadActions > .quote-icon-button")];
      const quoteHeaderRects = quoteHeaderButtons.map((button) => button.getBoundingClientRect());
      if (quoteHeaderButtons.length !== 4 || quoteHeaderButtons.some((button) => button.textContent.trim() || !button.querySelector("svg") || !button.dataset.tooltip)) throw new Error("Les quatre actions de l’en-tête doivent rester des SVG seuls avec info-bulle");
      if (Math.max(...quoteHeaderRects.map((rect) => rect.width)) - Math.min(...quoteHeaderRects.map((rect) => rect.width)) > 1 || quoteHeaderRects.some((rect) => rect.right > checkoutRect.right + 1)) throw new Error("Les actions de l’en-tête de caisse sont déséquilibrées ou débordent");
      const clientHeaderButton = document.querySelector("#clientButton");
      const quoteHeaderControls = [clientHeaderButton, ...quoteHeaderButtons];
      const quoteHeaderControlRects = quoteHeaderControls.map((button) => button.getBoundingClientRect());
      const interceptedHeaderControls = quoteHeaderControls.filter((button) => {
        const rect = button.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return !button.contains(hit);
      });
      if (clientHeaderButton.parentElement !== document.querySelector("#quoteHeadActions") || clientHeaderButton.nextElementSibling !== document.querySelector("#newQuoteButton")) throw new Error("Le client n’est pas intégré avant les actions du devis");
      if (interceptedHeaderControls.length) throw new Error("Des actions de l’en-tête sont interceptées : " + interceptedHeaderControls.map((button) => button.id).join(", "));
      if (document.querySelector("#saveButton").disabled) throw new Error("Enregistrer reste impossible à cliquer quand le devis est vide");
      document.querySelector("#saveButton").click();
      if (!/Ajoutez une prestation avant d’enregistrer/.test(document.querySelector("#toastRegion").textContent)) throw new Error("Enregistrer un devis vide n’explique pas l’action attendue");
      document.querySelector(".toast-close")?.click();
      const windowControlsRect = document.querySelector("#windowControls").getBoundingClientRect();
      const receiptHeadRect = document.querySelector(".receipt-head").getBoundingClientRect();
      const restingReceiptPadding = Number.parseFloat(getComputedStyle(document.querySelector(".receipt-head")).paddingRight);
      const centerDelta = Math.abs((receiptHeadRect.top + receiptHeadRect.height / 2) - (windowControlsRect.top + windowControlsRect.height / 2));
      if (centerDelta > 2) throw new Error("Les contrôles de fenêtre et l’en-tête du devis ne partagent pas la même ligne");
      const overlapsWindowControls = quoteHeaderControlRects.some((rect) => (
        rect.left < windowControlsRect.right
        && rect.right > windowControlsRect.left
        && rect.top < windowControlsRect.bottom
        && rect.bottom > windowControlsRect.top
      ));
      if (overlapsWindowControls) throw new Error("Les actions de l’en-tête de caisse sont recouvertes par les contrôles de la fenêtre");
      if (restingReceiptPadding < 30 || restingReceiptPadding > 36) throw new Error("Le rail replié réserve encore trop de place dans la caisse");
      document.querySelector("#windowMinimizeButton").focus();
      const expandedWindowControlsRect = document.querySelector("#windowControls").getBoundingClientRect();
      const expandedWindowControlsStyle = getComputedStyle(document.querySelector("#windowControls"));
      const expandedHitTarget = document.elementFromPoint(expandedWindowControlsRect.left + 2, expandedWindowControlsRect.top + expandedWindowControlsRect.height / 2);
      const overlapsExpandedWindowControls = quoteHeaderControlRects.some((rect) => (
        rect.left < expandedWindowControlsRect.right
        && rect.right > expandedWindowControlsRect.left
        && rect.top < expandedWindowControlsRect.bottom
        && rect.bottom > expandedWindowControlsRect.top
      ));
      if (expandedWindowControlsRect.width < 120 || Number.parseInt(getComputedStyle(document.querySelector("#windowControls")).zIndex, 10) <= (Number.parseInt(getComputedStyle(document.querySelector(".receipt-head")).zIndex, 10) || 0)) throw new Error("Les contrôles de fenêtre déployés ne passent pas correctement au-dessus du devis");
      if (!overlapsExpandedWindowControls) throw new Error("Le rail déployé ne récupère pas l’espace réservé inutilement dans l’en-tête du devis");
      if (expandedWindowControlsStyle.backgroundColor.startsWith("rgba") || !document.querySelector("#windowControls").contains(expandedHitTarget)) throw new Error("Le rail déployé n’est pas opaque ou laisse passer les clics");
      document.querySelector("#newQuoteButton").focus();
      const familyPanelRect = document.querySelector("#familyPanel").getBoundingClientRect();
      const familyHeadRect = document.querySelector(".family-head").getBoundingClientRect();
      const familySearchToggle = document.querySelector("#catalogSearchToggle");
      const familySearchToggleRect = familySearchToggle.getBoundingClientRect();
      const firstFamilyButtonRect = document.querySelector(".family-button").getBoundingClientRect();
      const searchHitTarget = document.elementFromPoint(familySearchToggleRect.left + familySearchToggleRect.width / 2, familySearchToggleRect.top + familySearchToggleRect.height / 2);
      if (document.querySelector("#familyNavTitle").textContent !== "Soins" || document.querySelector("#checkoutTitle").textContent !== "Devis") throw new Error("Les zones principales n’utilisent pas leurs noms courts");
      if (document.querySelector("#familyNavTitle").getBoundingClientRect().width > 1 || document.querySelector("#checkoutTitle").getBoundingClientRect().width > 1) throw new Error("Les titres Soins et Devis sont encore visibles");
      if (familyHeadRect.height > 1 || familyHeadRect.top - familyPanelRect.top > 8) throw new Error("La loupe réserve encore une ligne dans les prestations");
      if (getComputedStyle(document.querySelector(".family-title-row")).position !== "absolute" || !familySearchToggle.contains(searchHitTarget)) throw new Error("La loupe absolue n’est plus directement cliquable");
      if (Math.abs(firstFamilyButtonRect.top - familySearchToggleRect.top) > 2) throw new Error("La loupe ne se superpose pas discrètement à la première prestation");
      familySearchToggle.click();
      await new Promise((resolve) => setTimeout(resolve, 30));
      const openedFamilyHeadRect = document.querySelector(".family-head").getBoundingClientRect();
      const openedSearchRect = document.querySelector("#catalogSearchPanel").getBoundingClientRect();
      const openedToggleRect = familySearchToggle.getBoundingClientRect();
      if (document.querySelector("#catalogSearchPanel").hidden || openedFamilyHeadRect.height < 38 || openedSearchRect.right > openedToggleRect.left - 4 || document.activeElement !== document.querySelector("#catalogSearch")) throw new Error("La recherche ne s’ouvre pas proprement à côté de la loupe");
      familySearchToggle.click();
      if (!document.querySelector("#catalogSearchPanel").hidden || document.querySelector(".family-head").getBoundingClientRect().height > 1) throw new Error("La recherche refermée conserve encore de la hauteur");
      const topbarUtilities = document.querySelector(".topbar-utilities");
      const utilityButtons = [...topbarUtilities.querySelectorAll(".topbar-utility-button")];
      const utilityRect = topbarUtilities.getBoundingClientRect();
      if (topbarUtilities.previousElementSibling !== document.querySelector(".topbar-context") || utilityButtons.length !== 2) throw new Error("Les deux utilitaires ne suivent pas directement le groupe des tarifs");
      if (utilityButtons.some((button) => button.textContent.trim() || !button.querySelector("svg") || !button.dataset.tooltip) || utilityRect.right >= checkoutRect.left) throw new Error("Les utilitaires du header ne sont pas des SVG compacts ou empiètent sur la caisse");
      const menuButton = document.querySelector("#appMenuButton");
      if (menuButton.childElementCount !== 1 || !menuButton.firstElementChild.matches("svg")) throw new Error("Le menu principal n’est pas réduit à son icône");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "m", code: "KeyM", altKey: true, bubbles: true, cancelable: true }));
      if (document.querySelector("#appActionsMenu").hidden) throw new Error("Alt+M n’ouvre pas le menu principal");
      if (!document.documentElement.classList.contains("bcdevis-context-menu-open")) throw new Error("Le menu Catalogue n’active pas la protection contre les clics absorbés");
      if (!document.documentElement.classList.contains("bcdevis-catalog-menu-open")) throw new Error("Le menu Catalogue n’active pas son niveau d’empilement prioritaire");
      if (getComputedStyle(document.querySelector(".topbar")).zIndex !== "auto") throw new Error("L’en-tête principal recouvre encore le haut de la caisse quand le menu Catalogue est ouvert");
      if (Number.parseInt(getComputedStyle(document.querySelector("#appActions")).zIndex, 10) !== 410 || Number.parseInt(getComputedStyle(document.querySelector("#appActionsMenu")).zIndex, 10) !== 420) throw new Error("Le menu Catalogue ne passe pas devant toutes les surfaces");
      if (document.querySelector("#appActionsMenu .app-menu-status") || document.querySelector("#saveState")) throw new Error("Le menu Actions conserve une ligne d’état inutile");
      const menuRect = document.querySelector("#appActionsMenu").getBoundingClientRect();
      if (menuRect.right >= checkoutRect.left) throw new Error("Le menu Actions est recouvert par la caisse");
      if (menuRect.width > 330 || menuRect.height > 230) throw new Error("Le menu Catalogue occupe encore trop d’espace");
      if ([...document.querySelectorAll("#appActionsMenu strong")].map((label) => label.textContent).join("|") !== "Sur mesure|Prix|Auto|Mobile|Bureau") throw new Error("Le menu Catalogue n’utilise pas les cinq libellés courts attendus");
      document.querySelector(".brand-block").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      if (!document.querySelector("#appActionsMenu").hidden || document.documentElement.classList.contains("bcdevis-context-menu-open") || document.documentElement.classList.contains("bcdevis-catalog-menu-open")) throw new Error("Un clic extérieur ne referme pas immédiatement le menu Catalogue");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "m", code: "KeyM", altKey: true, bubbles: true, cancelable: true }));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "m", code: "KeyM", altKey: true, bubbles: true, cancelable: true }));
      if (!document.querySelector("#appActionsMenu").hidden || document.activeElement !== menuButton) throw new Error("Alt+M ne referme pas proprement le menu principal");
      if (document.querySelector("#appActionsMenu").textContent.includes("Gestion du devis")) throw new Error("La gestion du devis est encore dupliquée dans le menu principal");
      const displayModeOptions = [...document.querySelectorAll("[data-display-mode-option]")];
      if (displayModeOptions.length !== 3 || document.documentElement.dataset.displayPreference !== "auto" || document.documentElement.dataset.displayMode !== "full") throw new Error("Le mode d’affichage automatique n’est pas initialisé sur ordinateur");
      menuButton.click();
      document.querySelector("#displayModeSmartphone").click();
      const smartphoneShellRect = document.querySelector("#appShell").getBoundingClientRect();
      const smartphoneTabsRect = document.querySelector("#mobileTabs").getBoundingClientRect();
      const smartphoneTabButtons = [...document.querySelectorAll("#mobileTabs > button")].map((button) => button.getBoundingClientRect());
      const smartphoneTabIcons = [...document.querySelectorAll("#mobileTabs svg")].map((icon) => icon.getBoundingClientRect());
      if (document.documentElement.dataset.displayPreference !== "smartphone" || document.documentElement.dataset.displayMode !== "smartphone") throw new Error("Le mode Smartphone ne s’applique pas depuis Catalogue");
      if (document.querySelector("#checkoutPanel").classList.contains("is-full-height") || document.documentElement.classList.contains("checkout-focus")) throw new Error("Le mode Smartphone conserve la caisse fixe du bureau");
      if (getComputedStyle(document.querySelector("#mobileTabs")).display === "none" || smartphoneShellRect.width > 641 || Math.abs((smartphoneShellRect.left + smartphoneShellRect.right) / 2 - document.documentElement.clientWidth / 2) > 1) throw new Error("Le mode Smartphone forcé n’utilise pas une surface mobile centrée");
      if (smartphoneTabsRect.left < smartphoneShellRect.left - 1 || smartphoneTabsRect.right > smartphoneShellRect.right + 1 || smartphoneTabButtons.some((rect) => rect.height < 48) || smartphoneTabIcons.some((rect) => rect.width > 24 || rect.height > 24)) throw new Error("La navigation forcée ne conserve pas ses dimensions smartphone");
      if (JSON.parse(localStorage.getItem("bcdevis-v1")).settings.displayMode !== "smartphone") throw new Error("Le mode Smartphone n’est pas sauvegardé localement");
      menuButton.click();
      document.querySelector("#displayModeFull").click();
      if (document.documentElement.dataset.displayMode !== "full" || !document.querySelector("#checkoutPanel").classList.contains("is-full-height")) throw new Error("Le mode Complet ne restaure pas la disposition du bureau");
      menuButton.click();
      document.querySelector("#displayModeAuto").click();
      if (JSON.parse(localStorage.getItem("bcdevis-v1")).settings.displayMode !== "auto" || document.querySelector("#displayModeAuto").getAttribute("aria-checked") !== "true") throw new Error("Le retour au mode Automatique n’est pas sauvegardé ou annoncé");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "p", code: "KeyP", altKey: true, bubbles: true, cancelable: true }));
      if (!document.querySelector("#familyPanel").classList.contains("show-family-prices") || document.querySelector("#familyPriceToggle").getAttribute("aria-checked") !== "true") throw new Error("Alt+P n’affiche pas les prix");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "p", code: "KeyP", altKey: true, bubbles: true, cancelable: true }));
      if (document.querySelector("#familyPanel").classList.contains("show-family-prices") || document.querySelector("#familyPriceToggle").getAttribute("aria-checked") !== "false") throw new Error("Alt+P ne masque pas les prix");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "N", code: "KeyN", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
      if (document.querySelector("#customItemLayer").hidden) throw new Error("Ctrl+Maj+N n’ouvre pas la prestation sur mesure");
      document.querySelector('#customItemLayer [data-close="customItemLayer"]').click();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "h", code: "KeyH", ctrlKey: true, bubbles: true, cancelable: true }));
      if (document.querySelector("#historyLayer").hidden) throw new Error("Ctrl+H n’ouvre pas l’historique");
      document.querySelector('#historyLayer [data-close="historyLayer"]').click();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "?", code: "Slash", shiftKey: true, bubbles: true, cancelable: true }));
      if (document.querySelector("#shortcutHelpLayer").hidden) throw new Error("? n’ouvre pas l’aide des raccourcis");
      const shortcutCard = document.querySelector(".shortcut-help-modal");
      const shortcutRect = shortcutCard.getBoundingClientRect();
      const shortcutGroups = shortcutCard.querySelector(".shortcut-groups");
      const shortcutLists = [...shortcutCard.querySelectorAll(".shortcut-list")];
      if (shortcutRect.left < 0 || shortcutRect.right > innerWidth + 1 || shortcutRect.bottom > innerHeight + 1) throw new Error("L’aide des raccourcis déborde de la fenêtre");
      if (shortcutGroups.scrollWidth > shortcutGroups.clientWidth + 1 || getComputedStyle(shortcutGroups).gridTemplateColumns.trim().split(/\\s+/).length !== 2) throw new Error("L’aide des raccourcis n’utilise pas correctement ses deux colonnes");
      if (shortcutLists.length !== 4 || shortcutLists.some((list) => getComputedStyle(list).gridTemplateColumns.trim().split(/\\s+/).length !== 1) || shortcutCard.querySelectorAll(".shortcut-list>div").length !== 16) throw new Error("Les groupes de raccourcis sont incomplets ou mal structurés");
      document.querySelector('#shortcutHelpLayer [data-close="shortcutHelpLayer"]').click();
      const taxHeaderToggle = document.querySelector(".tax-header-toggle");
      if (taxHeaderToggle.textContent.trim() !== "TVA") throw new Error("Le toggle TVA conserve un libellé inutilement long");
      if (!taxHeaderToggle.hidden) throw new Error("La TVA doit être masquée par défaut dans la caisse");
      document.querySelector("#moreQuoteButton").click();
      const quoteMenu = document.querySelector("#quoteActionMenu");
      const quoteMenuRect = quoteMenu.getBoundingClientRect();
      if (quoteMenu.hidden || quoteMenu.querySelectorAll('[role="menuitem"]').length !== 4) throw new Error("Le menu des actions du devis est incomplet");
      if (quoteMenuRect.left < checkoutRect.left || quoteMenuRect.right > checkoutRect.right + 1) throw new Error("Le menu des actions du devis déborde de la caisse");
      document.querySelector("#newQuoteButton").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      if (!quoteMenu.hidden) throw new Error("Le menu … reste coincé lors d’un clic sur une autre action de la caisse");
      const catalogSearch = document.querySelector("#catalogSearch");
      document.querySelector('[data-offer-mode="pack"]').click();
      catalogSearch.value = "Torse";
      catalogSearch.dispatchEvent(new Event("input", { bubbles: true }));
      const denseService = document.querySelector('[data-family-service-id="135"]');
      const denseShell = denseService?.closest("[data-density-card]");
      const denseToggle = denseShell?.querySelector("[data-tile-detail-toggle]");
      if (!denseService || denseShell?.dataset.density !== "compact" || !denseToggle || denseToggle.hidden) throw new Error("La prestation longue n’active pas automatiquement son mode compact");
      const tileDetailLayer = document.querySelector("#tileDetailLayer");
      denseService.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
      denseService.focus();
      if (!tileDetailLayer.hidden) throw new Error("Le détail s’ouvre encore sans action sur le bouton œil");
      denseToggle.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
      await new Promise((resolve) => setTimeout(resolve, 160));
      if (tileDetailLayer.hidden || !tileDetailLayer.classList.contains("is-open") || tileDetailLayer.classList.contains("is-pinned")) throw new Error("Le survol du bouton œil n’ouvre pas son aperçu temporaire");
      denseToggle.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse", relatedTarget: document.body }));
      await new Promise((resolve) => setTimeout(resolve, 130));
      if (tileDetailLayer.classList.contains("is-open")) throw new Error("L’aperçu temporaire reste ouvert après avoir quitté le bouton œil");
      denseToggle.click();
      if (tileDetailLayer.hidden || !tileDetailLayer.classList.contains("is-open")) throw new Error("Le détail de la prestation longue ne s’ouvre pas au clic");
      if (document.querySelector("#tileDetailTitle")?.textContent !== "Torse, abdomen, cou, dos complet, épaules, nuque, aisselles et demi-bras") throw new Error("Le détail ne restitue pas le libellé complet");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      if (tileDetailLayer.classList.contains("is-open")) throw new Error("Échap ne ferme pas le détail d’une prestation");
      const shortShell = document.querySelector('[data-family-service-id="132"]')?.closest("[data-density-card]");
      if (!shortShell || shortShell.dataset.density !== "normal" || !shortShell.querySelector("[data-tile-detail-toggle]")?.hidden) throw new Error("Une prestation courte est compactée inutilement");
      catalogSearch.value = "Lèvre supérieure + menton";
      catalogSearch.dispatchEvent(new Event("input", { bubbles: true }));
      const combinedService = document.querySelector('[data-family-service-id="111"]');
      const combinedPackPrice = new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(153).replaceAll(" ", " ");
      if (!combinedService || combinedService.querySelector(".family-option-price")?.textContent !== combinedPackPrice) throw new Error("La zone combinée n’affiche pas son prix moyen Pack 6 + 1");
      if (combinedService.querySelector(".family-option-price")?.title !== "Prix moyen par session du Pack 6 + 1") throw new Error("Le prix Pack de la zone combinée n’est pas expliqué");
      combinedService.click();
      const combinedQuote = JSON.parse(localStorage.getItem("bcdevis-v1")).current;
      const combinedLine = combinedQuote.lines.find((line) => String(line.serviceId) === "111");
      if (!combinedLine || combinedLine.price !== 179 || combinedLine.quantity !== 6 || combinedLine.freeQuantity !== 1 || combinedLine.offerType !== "pack") throw new Error("La zone combinée ne conserve pas six séances payées à 179 CHF et une offerte");
      const combinedPayable = new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(1074).replaceAll(" ", " ");
      if (document.querySelector("#grandTotalValue").textContent !== combinedPayable) throw new Error("Le Pack de la zone combinée ne facture pas exactement six séances");
      document.querySelector('[data-line-id="' + combinedLine.id + '"] [data-line-action="remove"]').click();
      document.querySelector('[data-offer-mode="single"]').click();
      catalogSearch.value = "Zone spéciale 100 cm²";
      catalogSearch.dispatchEvent(new Event("input", { bubbles: true }));
      const specialService = document.querySelector('[data-family-service-id="108"]');
      if (!specialService) throw new Error("La prestation Zone spéciale 100 cm² est introuvable");
      specialService.click();
      catalogSearch.value = "";
      catalogSearch.dispatchEvent(new Event("input", { bubbles: true }));
      const serviceIds = [...document.querySelectorAll("[data-family-service-id]")]
        .map((service) => service.dataset.familyServiceId)
        .filter((serviceId) => serviceId !== "108")
        .slice(0, 4);
      if (serviceIds.length < 4) throw new Error("Moins de quatre prestations complémentaires disponibles pour tester la caisse");
      for (const serviceId of serviceIds) document.querySelector('[data-family-service-id="' + serviceId + '"]').click();
      for (let index = 1; index < 6; index += 1) {
        document.querySelector('[data-family-service-id="' + serviceIds[0] + '"]').click();
      }
      const packOfferAction = document.querySelector(".cart-line .pack-offer-action");
      if (!packOfferAction) throw new Error("La proposition de séance offerte n’apparaît pas au seuil du pack");
      packOfferAction.click();
      const convertedPackLine = document.querySelector(".cart-line.offer-pack");
      if (!convertedPackLine || convertedPackLine.querySelector('[data-quantity-value="free"]')?.textContent.trim() !== "1") {
        throw new Error("La conversion en pack ne conserve pas correctement la séance offerte");
      }
      const increasePaid = convertedPackLine.querySelector('[data-line-action="increase"]');
      const decreasePaid = convertedPackLine.querySelector('[data-line-action="decrease"]');
      const increaseFree = convertedPackLine.querySelector('[data-line-action="increase-free"]');
      const decreaseFree = convertedPackLine.querySelector('[data-line-action="decrease-free"]');
      if (![increasePaid, decreasePaid, increaseFree, decreaseFree].every(Boolean)) throw new Error("Les boutons tactiles −/+ du Pack sont incomplets");
      increaseFree.click();
      let adjustedPackLine = JSON.parse(localStorage.getItem("bcdevis-v1")).current.lines.find((line) => line.offerType === "pack");
      if (adjustedPackLine?.freeQuantity !== 2 || document.querySelector('.cart-line.offer-pack [data-quantity-value="free"]')?.textContent.trim() !== "2") throw new Error("Le bouton + des séances offertes ne fonctionne pas");
      document.querySelector('.cart-line.offer-pack [data-line-action="decrease-free"]').click();
      adjustedPackLine = JSON.parse(localStorage.getItem("bcdevis-v1")).current.lines.find((line) => line.offerType === "pack");
      if (adjustedPackLine?.freeQuantity !== 1) throw new Error("Le bouton − des séances offertes ne fonctionne pas");
      document.querySelector('.cart-line.offer-pack [data-line-action="decrease"]').click();
      document.querySelector('.cart-line.offer-pack [data-line-action="increase"]').click();
      adjustedPackLine = JSON.parse(localStorage.getItem("bcdevis-v1")).current.lines.find((line) => line.offerType === "pack");
      if (adjustedPackLine?.quantity !== 6) throw new Error("Les boutons −/+ des séances payées ne restaurent pas la quantité");
      if (!document.querySelector('.cart-line:not(.offer-pack) [data-line-action="decrease"]')?.disabled) throw new Error("Le bouton − doit être désactivé à la quantité minimale");
      const totalsQuote = JSON.parse(localStorage.getItem("bcdevis-v1")).current;
      const totalsPackLine = totalsQuote.lines.find((line) => line.offerType === "pack");
      const displayMoney = (value) => new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0).replaceAll(" ", " ");
      const catalogTotal = totalsQuote.lines.reduce((sum, line) => {
        const unitPrice = line.offerType === "student" ? Number(line.basePrice ?? line.price) || 0 : Number(line.price) || 0;
        return sum + unitPrice * (Number(line.quantity) + (line.offerType === "pack" ? Number(line.freeQuantity) : 0));
      }, 0);
      const packDiscount = Number(totalsPackLine.price) * Number(totalsPackLine.freeQuantity);
      const paidTotal = catalogTotal - packDiscount;
      if (convertedPackLine.querySelector(".cart-line-price").textContent !== displayMoney(Number(totalsPackLine.price) * (Number(totalsPackLine.quantity) + Number(totalsPackLine.freeQuantity)))) throw new Error("La ligne Pack n’affiche pas sa valeur complète avant offre");
      if (document.querySelector("#subtotalValue").textContent !== displayMoney(catalogTotal)) throw new Error("Le total avant offres ne reprend pas toutes les séances");
      if (document.querySelector("#totalDiscountRow").hidden || document.querySelector("#totalDiscountValue").textContent !== "− " + displayMoney(packDiscount)) throw new Error("Le rabais total ne valorise pas la séance offerte");
      if (document.querySelector("#grandTotalValue").textContent !== displayMoney(paidTotal)) throw new Error("Le total à payer facture encore une séance offerte");
      if (/undefined/i.test(document.querySelector("#toastRegion").textContent)) throw new Error("Le message de conversion en pack contient une valeur indéfinie");
      const specialLineName = [...document.querySelectorAll(".cart-line-name")].find((input) => input.value === "Zone spéciale 100 cm²");
      if (!specialLineName) throw new Error("Zone spéciale 100 cm² n’apparaît pas dans la caisse");
      const specialLine = specialLineName.closest(".cart-line");
      const specialLineMain = specialLine.querySelector(".cart-line-main");
      const specialControls = specialLine.querySelector(".cart-line-inline-controls");
      const specialCategory = specialLine.querySelector(".cart-line-category");
      const specialDelete = specialLine.querySelector('.cart-line-delete-zone [data-line-action="remove"]');
      const specialNameRect = specialLineName.getBoundingClientRect();
      const specialControlsRect = specialControls.getBoundingClientRect();
      const specialRowRect = specialLine.getBoundingClientRect();
      const specialNameStyle = getComputedStyle(specialLineName);
      if (!specialLineMain || !specialDelete || specialControls.contains(specialDelete)) throw new Error("La suppression occupe encore la largeur des contrôles −/+");
      if (specialDelete.getAttribute("aria-label") !== "Supprimer Zone spéciale 100 cm²") throw new Error("La suppression au bord droit n’identifie pas la prestation");
      if (specialNameRect.right > specialControlsRect.left + 1) throw new Error("Zone spéciale 100 cm² chevauche encore sa catégorie et ses contrôles");
      if (specialControlsRect.right > specialRowRect.right + 1) throw new Error("Les contrôles de Zone spéciale 100 cm² débordent de la caisse");
      if (specialNameStyle.textOverflow !== "ellipsis" || specialNameStyle.overflowX !== "hidden" || specialNameStyle.whiteSpace !== "nowrap") throw new Error("Les prestations longues ne sont pas tronquées avec une ellipse");
      if (specialLineName.scrollWidth <= specialLineName.clientWidth + 1) throw new Error("Zone spéciale 100 cm² n’active pas réellement la troncature prévue");
      if (specialLineName.title !== specialLineName.value || specialCategory.title !== "Poitrine et abdomen") throw new Error("Le libellé complet tronqué n’est pas disponible au survol");
      const swipe = (fromX, toX, pointerId) => {
        const init = (clientX) => ({ bubbles: true, cancelable: true, pointerId, pointerType: "touch", isPrimary: true, button: 0, clientX, clientY: 120 });
        specialLineMain.dispatchEvent(new PointerEvent("pointerdown", init(fromX)));
        specialLineMain.dispatchEvent(new PointerEvent("pointermove", init(toX)));
        specialLineMain.dispatchEvent(new PointerEvent("pointerup", init(toX)));
      };
      swipe(260, 242, 71);
      if (specialLine.classList.contains("is-delete-revealed")) throw new Error("Un balayage tactile trop court révèle la suppression");
      swipe(260, 195, 72);
      if (!specialLine.classList.contains("is-delete-revealed")) throw new Error("Le balayage tactile vers la gauche ne révèle pas la suppression");
      if (getComputedStyle(specialDelete).pointerEvents === "none") throw new Error("La poubelle tactile révélée ne peut pas être activée");
      specialDelete.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      if (specialLine.classList.contains("is-delete-revealed")) throw new Error("Échap ne referme pas la suppression révélée");
      const cartViewport = document.querySelector("#cartLines").getBoundingClientRect();
      const visibleRows = [...document.querySelectorAll(".cart-line")].filter((row) => {
        const rect = row.getBoundingClientRect();
        return rect.top >= cartViewport.top - 1 && rect.bottom <= cartViewport.bottom + 1;
      });
      if (visibleRows.length < 5) throw new Error("La zone prestations doit afficher cinq lignes à 900 px de haut");
      if (document.querySelector("#saveButton").disabled) throw new Error("Enregistrer doit devenir disponible dès qu’une prestation est ajoutée");
      const installmentWrap = document.querySelector("#installmentTableWrap");
      const installmentRows = installmentWrap.querySelectorAll("tr");
      const installmentColumnCount = installmentRows[0]?.children.length || 0;
      if (installmentWrap.hidden || installmentRows.length !== 2 || installmentColumnCount < 3 || installmentRows[1].children.length !== installmentColumnCount) throw new Error("Le tableau d’échelonnement doit contenir exactement deux lignes équilibrées");
      if (installmentWrap.querySelector("summary, .installment-note") || installmentWrap.getBoundingClientRect().height > 52) throw new Error("Le tableau d’échelonnement conserve une présentation trop volumineuse");
      if (getComputedStyle(installmentRows[0].children[0]).textAlign !== "center" || Number.parseFloat(getComputedStyle(installmentRows[1].children[0]).fontSize) > 11) throw new Error("Le tableau d’échelonnement n’est pas centré et compact");
      const actionRects = checkoutActions.map((button) => button.getBoundingClientRect());
      if (actionRects.some((rect) => rect.bottom > checkoutRect.bottom + 1)) throw new Error("Les actions rapides débordent de la caisse");
      if (Math.max(...actionRects.map((rect) => rect.width)) - Math.min(...actionRects.map((rect) => rect.width)) > 1) throw new Error("Les quatre actions rapides doivent avoir la même largeur");
      if (document.querySelector("#couponToggle").textContent.trim() !== "Coupon") throw new Error("L’action coupon n’utilise pas son libellé court explicite");

      const priceWithoutTax = document.querySelector("#grandTotalValue").textContent;
      window.dispatchEvent(new Event("beforeprint"));
      if (/TVA|Net HT|Total TTC/.test(document.querySelector("#printQuote").textContent)) throw new Error("Le devis affiche encore une information TVA par défaut");
      document.querySelector("#settingsButton").click();
      document.querySelector('[data-settings-tab="pricing"]').click();
      const taxVisibilitySetting = document.querySelector('#settingsForm [name="showTaxInformation"]');
      if (taxVisibilitySetting.checked) throw new Error("Le réglage TVA devrait être désactivé par défaut");
      const taxSettingCard = taxVisibilitySetting.closest(".settings-toggle-card");
      if (!taxSettingCard || getComputedStyle(taxSettingCard).display !== "grid" || taxSettingCard.querySelector(".settings-toggle-icon use")?.getAttribute("href") !== "#icon-percent") throw new Error("Le réglage TVA n’utilise pas la nouvelle carte-interrupteur");
      if (!getComputedStyle(taxSettingCard.querySelector(".settings-toggle-status"), "::before").content.includes("Désactivé")) throw new Error("L’état désactivé de la TVA n’est pas lisible");
      taxVisibilitySetting.checked = true;
      if (!getComputedStyle(taxSettingCard.querySelector(".settings-toggle-status"), "::before").content.includes("Activé")) throw new Error("L’état activé de la TVA n’est pas lisible");
      document.querySelector("#settingsForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      if (taxHeaderToggle.hidden || document.querySelector("#taxEnabled").checked) throw new Error("L’activation globale doit afficher le contrôle TVA sans modifier le devis courant");
      document.querySelector("#taxEnabled").click();
      if (document.querySelector("#taxTotalRow").hidden || document.querySelector("#grandTotalValue").textContent !== priceWithoutTax) throw new Error("L’affichage TVA ne doit pas modifier les prix finaux existants");
      window.dispatchEvent(new Event("beforeprint"));
      if (!/TVA/.test(document.querySelector("#printQuote").textContent)) throw new Error("Le devis n’affiche pas la TVA lorsqu’elle est explicitement activée");
      document.querySelector("#settingsButton").click();
      document.querySelector('[data-settings-tab="pricing"]').click();
      const activeTaxVisibilitySetting = document.querySelector('#settingsForm [name="showTaxInformation"]');
      if (!activeTaxVisibilitySetting.checked) throw new Error("Le réglage TVA activé n’est pas restauré");
      activeTaxVisibilitySetting.checked = false;
      document.querySelector('[data-settings-tab="interface"]').click();
      const ipadModes = [...document.querySelectorAll('#settingsForm [name="ipadLayoutMode"]')];
      if (ipadModes.length !== 3 || !ipadModes.find((input) => input.value === "off")?.checked) throw new Error("Le réglage iPad doit être désactivé par défaut");
      if (document.documentElement.dataset.ipadPreference !== "off" || document.documentElement.dataset.ipadLayout !== "standard") throw new Error("Le rendu iPad ne doit pas s’activer avant le choix de l’utilisateur");
      ipadModes.find((input) => input.value === "always").checked = true;
      document.querySelector("#settingsForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      if (document.documentElement.dataset.ipadLayout !== "optimized" || document.documentElement.dataset.ipadPreference !== "always") throw new Error("Le mode iPad forcé ne s’applique pas immédiatement");
      if (!taxHeaderToggle.hidden || !document.querySelector("#taxTotalRow").hidden || document.querySelector("#grandTotalValue").textContent !== priceWithoutTax) throw new Error("La désactivation TVA ne conserve pas la caisse et les prix attendus");
      window.dispatchEvent(new Event("beforeprint"));
      if (/TVA|Net HT|Total TTC/.test(document.querySelector("#printQuote").textContent)) throw new Error("Le devis conserve une information TVA après désactivation");
      const savedTaxSetting = JSON.parse(localStorage.getItem("bcdevis-v1")).settings.showTaxInformation;
      if (savedTaxSetting !== false) throw new Error("Le choix de masquer la TVA n’est pas sauvegardé localement");
      if (JSON.parse(localStorage.getItem("bcdevis-v1")).settings.ipadLayoutMode !== "always") throw new Error("Le choix d’affichage iPad n’est pas sauvegardé localement");
      document.querySelector("#settingsButton").click();
      document.querySelector('[data-settings-tab="document"]').click();
      const signatureSetting = document.querySelector('#settingsForm [name="showSignatures"]');
      const signatureSettingCard = signatureSetting.closest(".settings-toggle-card");
      if (!signatureSetting.checked || !signatureSettingCard || signatureSettingCard.querySelector(".settings-toggle-icon use")?.getAttribute("href") !== "#icon-signature") throw new Error("Le réglage des signatures n’utilise pas la nouvelle carte-interrupteur");
      if (!getComputedStyle(signatureSettingCard.querySelector(".settings-toggle-status"), "::before").content.includes("Activé")) throw new Error("L’état actif des signatures n’est pas lisible");
      signatureSetting.click();
      if (!getComputedStyle(signatureSettingCard.querySelector(".settings-toggle-status"), "::before").content.includes("Désactivé")) throw new Error("L’état désactivé des signatures n’est pas lisible");
      signatureSetting.click();
      document.querySelector('[data-settings-tab="interface"]').click();
      document.querySelector('#settingsLayer .modal-head [data-close="settingsLayer"]').click();

      const emptyClientButton = document.querySelector("#clientButton");
      if (!emptyClientButton.classList.contains("is-empty") || emptyClientButton.classList.contains("has-client") || emptyClientButton.getBoundingClientRect().width > 44 || !emptyClientButton.querySelector('#clientInitials use[href="#icon-user-plus"]') || !document.querySelector("#clientName").hidden) throw new Error("Le client vide n’est pas réduit au pictogramme client plus");
      document.querySelector("#clientButton").click();
      const client = document.querySelector("#clientForm");
      client.elements.name.value = "Sophie Martin";
      client.elements.phone.value = "+41 79 111 22 33";
      client.elements.email.value = "sophie@example.test";
      client.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      if (!document.querySelector("#clientButton").classList.contains("has-client") || !document.querySelector("#clientInitials").hidden || document.querySelector("#clientName").hidden || document.querySelector("#clientName").textContent !== "Sophie Martin" || !document.querySelector("#clientButton").getAttribute("aria-label").includes("Sophie Martin")) throw new Error("Le client renseigné n’affiche pas uniquement son nom");
      if (document.querySelector("#checkoutEmailButton use")?.getAttribute("href") !== "#icon-mail-attach" || document.querySelector("#checkoutEmailButton").closest("#checkoutTransmissionMenu")) throw new Error("L’e-mail avec PDF joint n’est pas directement accessible dans le devis");
      document.querySelector("#checkoutTransmitButton").click();
      if (document.querySelector("#checkoutTransmissionMenu").hidden) throw new Error("Envoyer n’ouvre pas les choix WhatsApp et Outlook Web");
      const transmissionMenuRect = document.querySelector("#checkoutTransmissionMenu").getBoundingClientRect();
      if (transmissionMenuRect.top < 0 || transmissionMenuRect.bottom > innerHeight || transmissionMenuRect.left < 0 || transmissionMenuRect.right > innerWidth) throw new Error("Le menu Envoyer sort de la fenêtre avec ses deux choix");
      const manualGroup = document.querySelector(".transmission-group-manual");
      if (manualGroup?.querySelectorAll('[role="menuitem"]').length !== 2 || !manualGroup.contains(document.querySelector("#checkoutWhatsAppButton")) || !manualGroup.contains(document.querySelector("#checkoutOutlookWebButton"))) throw new Error("WhatsApp et Outlook Web doivent être regroupés sous PDF à joindre");
      if (getComputedStyle(document.querySelector(".transmission-manual-grid")).gridTemplateColumns.split(" ").filter(Boolean).length !== 2) throw new Error("Les deux envois manuels doivent rester immédiatement visibles côte à côte");
      if (document.querySelector("#checkoutOutlookWebButton use")?.getAttribute("href") !== "#icon-web-mail") throw new Error("Outlook Web doit conserver une icône distincte");
      if (document.querySelector("#checkoutOutlookWebRecipient").textContent !== "sophie@example.test") throw new Error("Le choix Outlook Web ne reprend pas l’adresse du contact");
      if (!document.querySelector("#checkoutWhatsAppButton") || !document.querySelector("#checkoutOutlookWebButton") || !document.querySelector("#checkoutEmailButton")) throw new Error("Un choix de transmission est absent");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      if (!document.querySelector("#checkoutTransmissionMenu").hidden || document.activeElement !== document.querySelector("#checkoutTransmitButton")) throw new Error("Échap ne referme pas correctement Envoyer");

      document.querySelector("#settingsButton").click();
      document.querySelector('[data-theme="night"]').click();
      document.querySelector('[data-font="roboto"]').click();
      document.querySelector('#settingsLayer .modal-head [data-close="settingsLayer"]').click();
      if (document.documentElement.dataset.theme !== "light") throw new Error("L’annulation des réglages doit restaurer le thème enregistré");
      if (document.documentElement.dataset.font !== "red-hat") throw new Error("L’annulation des réglages doit restaurer la police enregistrée");

      document.querySelector("#settingsButton").click();
      for (const theme of ["light", "night", "forest", "bordeaux"]) {
        const themeCard = document.querySelector('[data-theme="' + theme + '"]');
        themeCard.click();
        if (document.documentElement.dataset.theme !== theme) throw new Error("Le thème " + theme + " ne s’applique pas");
        if (!themeCard.matches('[aria-checked="true"]')) throw new Error("Le thème " + theme + " n’est pas annoncé comme actif");
        if (document.querySelectorAll('#themePicker [aria-checked="true"]').length !== 1) throw new Error("Un seul thème doit être annoncé comme actif");
        const expectedWindowColor = getComputedStyle(document.documentElement).getPropertyValue("--topbar-bg").trim().toLowerCase();
        const actualWindowColor = document.querySelector("#themeColorMeta").content.toLowerCase();
        if (actualWindowColor !== expectedWindowColor) throw new Error("La couleur de fenêtre ne correspond pas au thème " + theme);
        for (const [selector, token] of [
          [".topbar", "--topbar-bg"],
          [".family-panel", "--panel-bg"],
          [".catalog-panel", "--surface"],
          [".checkout-card", "--surface-raised"],
          [".local-badge>span", "--accent"]
        ]) {
          const expectedColor = normalizedColor(getComputedStyle(document.documentElement).getPropertyValue(token).trim());
          const actualColor = getComputedStyle(document.querySelector(selector)).backgroundColor;
          if (actualColor !== expectedColor) throw new Error("Surface " + selector + " incohérente pour " + theme);
        }
        if (document.querySelector("#headerLogo") || document.querySelector(".brand-logo")) {
          throw new Error("Le logo ne doit plus occuper l’en-tête dans le thème " + theme);
        }
      }
      for (const [font, family] of [
        ["red-hat", "Red Hat Display"],
        ["roboto", "Roboto"],
        ["roboto-slab", "Roboto Slab"],
        ["system", "Segoe UI"]
      ]) {
        const fontCard = document.querySelector('[data-font="' + font + '"]');
        fontCard.click();
        if (document.documentElement.dataset.font !== font) throw new Error("La police " + font + " ne s’applique pas");
        if (!fontCard.matches('[aria-checked="true"]')) throw new Error("La police " + font + " n’est pas annoncée comme active");
        if (document.querySelectorAll('#fontPicker [aria-checked="true"]').length !== 1) throw new Error("Une seule police doit être annoncée comme active");
        if (!getComputedStyle(document.body).fontFamily.includes(family)) throw new Error("La pile CSS ne correspond pas à la police " + font);
      }
      document.querySelector('[data-font="roboto-slab"]').click();
      const settings = document.querySelector("#settingsForm");
      settings.elements.companyName.value = "Clinique Bellecour Test";
      settings.elements.catalogMode.value = "body";
      settings.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      if (!document.querySelector(".interactive-body-map")) throw new Error("Le corps interactif ne remplace pas les tuiles après enregistrement");
      document.querySelector('button[data-body-side="back"]').click();
      document.querySelector('svg [data-body-region="back-dos"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
      if (document.querySelector("#bodyResultsTitle").textContent !== "Dos & nuque") throw new Error("La zone du dos n’affiche pas ses prestations");
      document.querySelector('svg [data-body-region="back-sif"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
      const sifServices = [...document.querySelectorAll(".body-service-options [data-family-service-id]")].map((item) => item.dataset.familyServiceId);
      if (document.querySelector("#bodyResultsTitle").textContent !== "Sillon interfessier (SIF)" || sifServices.join(",") !== "49") throw new Error("Le SIF doit rester une zone anatomique exacte");
      document.querySelector('button[data-body-side="front"]').click();
      if (document.querySelector("#bodyResultsTitle").textContent !== "Maillot & zone intime") throw new Error("Le passage avant/arrière doit conserver une zone corporelle cohérente");

      document.querySelector("#saveButton").click();
      return {
        client: document.querySelector("#clientName").textContent,
        lines: document.querySelectorAll(".cart-line").length,
        theme: document.documentElement.dataset.theme,
        font: document.documentElement.dataset.font,
        company: document.querySelector(".brand-block .eyebrow")?.textContent || "",
        catalogMode: document.querySelector(".interactive-body-map") ? "body" : "tiles"
      };
    })()`);
    assert.deepEqual(initial, { client: "Sophie Martin", lines: 5, theme: "bordeaux", font: "roboto-slab", company: "Clinique Bellecour Test", catalogMode: "body" });

    const trackingConfigured = await window.webContents.executeJavaScript(`(() => {
      document.querySelector("#settingsButton").click();
      document.querySelector("#settingsTabDocument").click();
      const settings = document.querySelector("#settingsForm");
      settings.elements.quoteTrackingEnabled.checked = true;
      settings.elements.quoteTrackingEnabled.dispatchEvent(new Event("input", { bubbles: true }));
      if (document.querySelector("#trackingSettingsDetails").hidden) throw new Error("Les réglages du suivi ne s’affichent pas après activation");
      settings.elements.validityDays.value = "45";
      settings.elements.trackingDefaultFollowUpDays.value = "7";
      settings.elements.trackingRemindersOnStartup.checked = true;
      settings.elements.trackingShowCounters.checked = true;
      settings.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      const stored = JSON.parse(localStorage.getItem("bcdevis-v1"));
      return {
        enabled: stored.settings.quoteTrackingEnabled,
        validityDays: stored.settings.validityDays,
        followUpDays: stored.settings.trackingDefaultFollowUpDays,
        settingsClosed: document.querySelector("#settingsLayer").hidden
      };
    })()`);
    assert.deepEqual(trackingConfigured, { enabled: true, validityDays: 45, followUpDays: 7, settingsClosed: true });

    const emailDraft = await window.webContents.executeJavaScript(`(async () => {
      window.confirm = () => true;
      window.__bcdevisEmailPayload = null;
      window.__bcdevisFallbackUrl = null;
      window.bcdevisDesktop = {
        savePdf: async (fileName) => ({ saved: true, fileName, filePath: "C:/Downloads/" + fileName }),
        composeEmail: async (payload) => {
          window.__bcdevisEmailPayload = payload;
          return { opened: true, attached: true, client: "outlook" };
        },
        openExternal: async (url) => { window.__bcdevisFallbackUrl = url; }
      };
      document.querySelector("#checkoutEmailButton").click();
      for (let attempt = 0; attempt < 20 && !window.__bcdevisEmailPayload; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return {
        payload: window.__bcdevisEmailPayload,
        fallbackUrl: window.__bcdevisFallbackUrl,
        tracking: JSON.parse(localStorage.getItem("bcdevis-v1")).current.tracking
      };
    })()`);
    assert.equal(emailDraft.payload.to, "sophie@example.test");
    assert.match(emailDraft.payload.attachmentPath, /DEV-\d{8}[A-Z0-9]*\d{3}\.pdf$/);
    assert.match(emailDraft.payload.body, /Total avant offres :/);
    assert.match(emailDraft.payload.body, /Rabais total :/);
    assert.match(emailDraft.payload.body, /Total à payer :/);
    assert.doesNotMatch(emailDraft.payload.body, /\+/);
    assert.doesNotMatch(emailDraft.payload.body, /—\s*—| — /);
    assert.equal(emailDraft.fallbackUrl, null, "Outlook ne doit pas être remplacé par mailto lorsque le PDF est joint");
    assert.equal(emailDraft.tracking.status, "sent", "L’envoi confirmé doit devenir le dernier statut commercial");
    assert.match(emailDraft.tracking.nextFollowUpAt, /^\d{4}-\d{2}-\d{2}$/, "Une relance doit être programmée après l’envoi");
    assert.ok(emailDraft.tracking.events.some((event) => event.status === "sent" && event.channel === "E-mail"), "La chronologie doit mémoriser le canal d’envoi");

    const outlookWebDraft = await window.webContents.executeJavaScript(`(async () => {
      window.__bcdevisFallbackUrl = null;
      document.querySelector("#checkoutTransmitButton").click();
      document.querySelector("#checkoutOutlookWebButton").click();
      for (let attempt = 0; attempt < 40 && document.querySelector("#checkoutOutlookWebButton").hasAttribute("aria-busy"); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return {
        url: window.__bcdevisFallbackUrl,
        toast: document.querySelector("#toastRegion").textContent
      };
    })()`);
    const outlookWebUrl = new URL(outlookWebDraft.url);
    assert.equal(outlookWebUrl.origin, "https://outlook.office.com");
    assert.equal(outlookWebUrl.pathname, "/mail/deeplink/compose");
    assert.equal(outlookWebUrl.searchParams.get("to"), "sophie@example.test");
    assert.match(outlookWebUrl.searchParams.get("subject"), /Votre devis DEV-/);
    assert.match(outlookWebUrl.searchParams.get("body"), /Total à payer :/);
    assert.match(outlookWebDraft.toast, /Outlook Web ouvert — joignez .* depuis Téléchargements/);

    const emailFailure = await window.webContents.executeJavaScript(`(async () => {
      window.__bcdevisFallbackUrl = null;
      window.bcdevisDesktop.composeEmail = async () => { throw new Error("Client e-mail indisponible"); };
      document.querySelector("#checkoutEmailButton").click();
      for (let attempt = 0; attempt < 40 && document.querySelector("#checkoutEmailButton").hasAttribute("aria-busy"); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return {
        fallbackUrl: window.__bcdevisFallbackUrl,
        toast: document.querySelector("#toastRegion").textContent
      };
    })()`);
    assert.equal(emailFailure.fallbackUrl, null, "Un échec de pièce jointe ne doit jamais ouvrir mailto");
    assert.match(emailFailure.toast, /Impossible d’ouvrir un e-mail avec le PDF joint/);

    const trackingWorkflow = await window.webContents.executeJavaScript(`(() => {
      document.querySelector("#historyButton").click();
      const historyTabs = document.querySelector("#historyTabs");
      const sentCard = document.querySelector(".history-item--sent");
      if (historyTabs.hidden || !sentCard || sentCard.querySelector(".history-status")?.textContent !== "Envoyé") throw new Error("Le statut coloré n’apparaît pas dans l’historique standard");
      const trackingTab = historyTabs.querySelector('[data-history-view="tracking"]');
      trackingTab.click();
      if (trackingTab.getAttribute("aria-selected") !== "true" || document.querySelector("#trackingFilters").hidden) throw new Error("L’onglet Suivi ne commute pas la vue");
      const sentFilter = document.querySelector('[data-tracking-filter="sent"]');
      sentFilter.click();
      const activeSentFilter = document.querySelector('[data-tracking-filter="sent"]');
      if (activeSentFilter.getAttribute("aria-pressed") !== "true" || activeSentFilter.querySelector("[data-filter-count]").textContent !== "1") throw new Error("Le filtre Envoyés ne compte pas le dernier statut");
      const disclosure = document.querySelector("[data-tracking-toggle]");
      disclosure.click();
      const expandedDisclosure = document.querySelector("[data-tracking-toggle]");
      if (expandedDisclosure.getAttribute("aria-expanded") !== "true" || document.querySelector(".tracking-detail").hidden) throw new Error("Le triangle n’ouvre pas la chronologie");
      const timelineCopy = document.querySelector(".tracking-timeline").textContent;
      if (!timelineCopy.includes("Brouillon créé") || !timelineCopy.includes("Devis envoyé") || !timelineCopy.includes("Canal : E-mail")) throw new Error("La chronologie ne reprend pas les changements de statut");
      const form = document.querySelector("[data-tracking-form]");
      form.elements.trackingStatus.value = "accepted";
      form.elements.trackingNote.value = "Accord confirmé par la cliente";
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      const stored = JSON.parse(localStorage.getItem("bcdevis-v1"));
      const saved = Object.values(stored.quotes)[0];
      document.querySelector('[data-history-view="history"]').click();
      return {
        status: saved.tracking.status,
        followUpAt: saved.tracking.nextFollowUpAt,
        hasAcceptedColor: Boolean(document.querySelector(".history-item--accepted")),
        hasAcceptedEvent: saved.tracking.events.some((event) => event.status === "accepted" && event.note === "Accord confirmé par la cliente"),
        tabsVisible: !document.querySelector("#historyTabs").hidden
      };
    })()`);
    assert.deepEqual(trackingWorkflow, { status: "accepted", followUpAt: "", hasAcceptedColor: true, hasAcceptedEvent: true, tabsVisible: true });
    await window.webContents.executeJavaScript(`document.querySelector('#historyLayer [data-close="historyLayer"]').click()`);

    await reload(window.webContents);
    const restored = await window.webContents.executeJavaScript(`(() => {
      document.querySelector("#historyButton").click();
      return {
        client: document.querySelector("#clientName").textContent,
        lines: document.querySelectorAll(".cart-line").length,
        theme: document.documentElement.dataset.theme,
        font: document.documentElement.dataset.font,
        bodyFont: getComputedStyle(document.body).fontFamily,
        company: document.querySelector(".brand-block .eyebrow")?.textContent || "",
        savedQuotes: document.querySelectorAll("#historyList [data-quote-id]").length,
        catalogMode: document.querySelector(".interactive-body-map") ? "body" : "tiles",
        catalogOverride: JSON.parse(localStorage.getItem("bcdevis-v1")).catalogOverrides?.["27"]
      };
    })()`);
    assert.match(restored.bodyFont, /Roboto Slab/, "La police sauvegardée doit être appliquée après rechargement");
    delete restored.bodyFont;
    assert.deepEqual(restored, { client: "Sophie Martin", lines: 5, theme: "bordeaux", font: "roboto-slab", company: "Clinique Bellecour Test", savedQuotes: 1, catalogMode: "body", catalogOverride: { name: "Barbe personnalisée", price: 230, duration: 40, icon: restored.catalogOverride.icon } });
    assert.match(restored.catalogOverride.icon, /^[a-z0-9-]+$/, "Le pictogramme personnalisé doit rester un identifiant SVG local sûr");

    const backupRestored = await window.webContents.executeJavaScript(`(() => {
      const today = new Date().toISOString().slice(0, 10);
      const restoredQuote = {
        id: "backup-smoke-quote",
        number: "DEV-" + today.replaceAll("-", "") + "A999",
        date: today,
        client: { name: "Sauvegarde vérifiée", phone: "+41 79 999 00 00", email: "backup@example.test", address: "Genève" },
        lines: [
          { id: 'backup-line" data-injected="true', name: "Prestation restaurée", price: 120, quantity: 2, categoryId: 1, duration: 30, offerType: "single" },
          { id: 'backup-line" data-injected="true', name: "Deuxième prestation restaurée", price: 80, quantity: 1, categoryId: 1, duration: 20, offerType: "single" }
        ],
        discount: { code: "", type: "percent", value: 0 },
        tax: { enabled: true, rate: 8.1, mode: "included" }
      };
      const payload = { type: "atelier-devis-backup", version: 17, database: { settings: { companyName: "Clinique sauvegardée", theme: "night", fontFamily: "roboto", ipadLayoutMode: "off" }, quotes: { [restoredQuote.id]: restoredQuote }, current: restoredQuote, customServices: [{ id: "custom-backup", name: "Soin sauvegardé", price: 75, duration: 20, categoryId: 1 }] } };
      const input = document.querySelector("#backupImportInput");
      const file = new File([JSON.stringify(payload)], "backup.json", { type: "application/json" });
      Object.defineProperty(input, "files", { configurable: true, value: [file] });
      window.confirm = () => true;
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const verify = () => {
          if (document.querySelector("#clientName").textContent === "Sauvegarde vérifiée") return resolve({
            client: document.querySelector("#clientName").textContent,
            lines: document.querySelectorAll(".cart-line").length,
            lineIds: [...document.querySelectorAll(".cart-line")].map((line) => line.dataset.lineId),
            injectedAttribute: Boolean(document.querySelector("[data-injected]")),
            theme: document.documentElement.dataset.theme,
            font: document.documentElement.dataset.font,
            ipadPreference: document.documentElement.dataset.ipadPreference,
            ipadLayout: document.documentElement.dataset.ipadLayout,
            catalogOverrideCount: Object.keys(JSON.parse(localStorage.getItem("bcdevis-v1")).catalogOverrides || {}).length,
            company: document.querySelector(".brand-block .eyebrow")?.textContent || ""
          });
          if (++attempts >= 30) return reject(new Error("La sauvegarde complète n’a pas été restaurée"));
          setTimeout(verify, 50);
        };
        input.dispatchEvent(new Event("change", { bubbles: true }));
        verify();
      });
    })()`);
    assert.equal(backupRestored.injectedAttribute, false, "Un identifiant importé ne doit pas injecter d’attribut HTML");
    assert.equal(new Set(backupRestored.lineIds).size, 2, "Les identifiants de lignes importées doivent rester uniques");
    assert.ok(backupRestored.lineIds.every((id) => /^[a-zA-Z0-9_-]+$/.test(id)), "Les identifiants de lignes importées doivent être nettoyés");
    delete backupRestored.injectedAttribute;
    delete backupRestored.lineIds;
    assert.deepEqual(backupRestored, { client: "Sauvegarde vérifiée", lines: 2, theme: "night", font: "roboto", ipadPreference: "off", ipadLayout: "standard", catalogOverrideCount: 0, company: "Clinique sauvegardée" });

    await reload(window.webContents);
    const backupAfterReload = await window.webContents.executeJavaScript(`(() => {
      document.querySelector("#historyButton").click();
      return { client: document.querySelector("#clientName").textContent, font: document.documentElement.dataset.font, savedQuotes: document.querySelectorAll("#historyList [data-quote-id]").length, releaseHidden: document.querySelector("#releaseNotesLayer").hidden, ipadPreference: document.documentElement.dataset.ipadPreference };
    })()`);
    assert.deepEqual(backupAfterReload, { client: "Sauvegarde vérifiée", font: "roboto", savedQuotes: 1, releaseHidden: true, ipadPreference: "off" });
    await window.webContents.executeJavaScript(`document.querySelector('#historyLayer [data-close="historyLayer"]').click()`);
    await window.webContents.executeJavaScript(`(() => {
      document.querySelector("#settingsButton").click();
      document.querySelector('#settingsForm [name="ipadLayoutMode"][value="always"]').checked = true;
      document.querySelector("#settingsForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      if (document.documentElement.dataset.ipadLayout !== "optimized") throw new Error("Le mode iPad forcé ne se réactive pas après restauration");
    })()`);

    for (const viewport of [
      { width: 1180, height: 820, hideBrand: false, label: "iPad paysage" },
      { width: 820, height: 1180, hideBrand: false, label: "iPad portrait" },
      { width: 600, height: 820, hideBrand: true, label: "iPad Split View" },
      { width: 390, height: 844, hideBrand: true, label: "mobile" }
    ]) {
      window.setContentSize(viewport.width, viewport.height);
      await new Promise((resolve) => setTimeout(resolve, 120));
      await window.webContents.executeJavaScript(`(() => {
        const checkout = document.querySelector("#checkoutPanel");
        const brand = document.querySelector(".brand-block");
        const topbar = document.querySelector(".topbar");
        const tariffRect = document.querySelector(".topbar-context").getBoundingClientRect();
        const utilitiesRect = document.querySelector(".topbar-utilities").getBoundingClientRect();
        const appShell = document.querySelector(".app-shell");
        const searchToggle = document.querySelector("#catalogSearchToggle");
        if (checkout.classList.contains("is-full-height") || document.documentElement.classList.contains("checkout-focus")) throw new Error("La caisse permanente bloque la navigation responsive");
        if (document.documentElement.dataset.ipadLayout !== "optimized") throw new Error("Le confort tactile est absent en mode ${viewport.label}");
        if (document.documentElement.dataset.displayPreference !== "auto" || document.documentElement.dataset.displayMode !== (${viewport.width} <= 600 ? "smartphone" : "full")) throw new Error("Le mode Automatique ne suit pas la largeur en mode ${viewport.label}");
        if (Math.abs(Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-viewport-height")) - innerHeight) > 2) throw new Error("La hauteur visuelle n’est pas synchronisée en mode ${viewport.label}");
        if (appShell.getBoundingClientRect().height > innerHeight + 1) throw new Error("La surface iPad dépasse la hauteur visible en mode ${viewport.label}");
        if (searchToggle.getBoundingClientRect().width < 44 || searchToggle.getBoundingClientRect().height < 44) throw new Error("La recherche reste trop petite au toucher en mode ${viewport.label}");
        if (Number.parseFloat(getComputedStyle(document.querySelector("#catalogSearch")).fontSize) < 16) throw new Error("Un champ déclenche encore le zoom Safari en mode ${viewport.label}");
        if (getComputedStyle(document.querySelector("#mobileTabs")).display === "none") throw new Error("La navigation mobile est absente à ${viewport.width}px");
        if (document.documentElement.scrollWidth > innerWidth + 1 || topbar.scrollWidth > topbar.clientWidth + 1) throw new Error("Le header déborde à ${viewport.width}px");
        if (utilitiesRect.left < tariffRect.right - 1 || utilitiesRect.right > topbar.getBoundingClientRect().right + 1) throw new Error("Les utilitaires chevauchent les tarifs à ${viewport.width}px");
        if ((getComputedStyle(brand).display === "none") !== ${viewport.hideBrand}) throw new Error("La marque n’est pas adaptée à ${viewport.width}px");
        document.querySelector('[data-panel="checkoutPanel"]').click();
        const receiptRect = document.querySelector(".receipt-head").getBoundingClientRect();
        const receiptActionsRect = document.querySelector("#quoteHeadActions").getBoundingClientRect();
        if (document.querySelector("#checkoutTitle").getBoundingClientRect().width > 1 || receiptActionsRect.left < receiptRect.left - 1 || receiptActionsRect.right > receiptRect.right + 1) throw new Error("L’en-tête discret de caisse déborde à ${viewport.width}px");
        const quickActions = document.querySelector(".checkout-primary-actions");
        const quickRect = quickActions.getBoundingClientRect();
        const quickButtons = [...quickActions.querySelectorAll(":scope > button")].map((button) => button.getBoundingClientRect());
        if (quickRect.left < 0 || quickRect.right > innerWidth + 1 || quickRect.bottom > innerHeight + 1) throw new Error("Les actions de caisse débordent à ${viewport.width}px");
        if (Math.max(...quickButtons.map((rect) => rect.width)) - Math.min(...quickButtons.map((rect) => rect.width)) > 1) throw new Error("Les actions de caisse sont déséquilibrées à ${viewport.width}px");
        if (document.documentElement.scrollWidth > innerWidth + 1) throw new Error("La caisse crée un défilement horizontal à ${viewport.width}px");
        const quoteDate = document.querySelector("#quoteDate");
        quoteDate.value = quoteDate.value === "2026-07-26" ? "2026-07-25" : "2026-07-26";
        quoteDate.dispatchEvent(new Event("change", { bubbles: true }));
        document.querySelector("#saveButton").click();
        const toastRegion = document.querySelector("#toastRegion");
        const toastRect = toastRegion.getBoundingClientRect();
        const toastStyle = getComputedStyle(toastRegion);
        if (toastRegion.parentElement !== document.body) throw new Error("La notification doit rester dans le calque global à ${viewport.width}px");
        if (toastStyle.position !== "fixed" || Number(toastStyle.zIndex) <= 100) throw new Error("La notification n’est pas au-dessus des calques de l’application à ${viewport.width}px");
        if (!/enregistré dans Mes devis/.test(toastRegion.textContent) || toastRect.height < 30) throw new Error("La notification d’enregistrement n’est pas visible à ${viewport.width}px");
        if (toastRect.top < topbar.getBoundingClientRect().bottom || toastRect.left < 0 || toastRect.right > innerWidth + 1 || toastRect.width < Math.min(300, innerWidth - 24)) throw new Error("La notification est mal positionnée à ${viewport.width}px");
        document.querySelector("#moreQuoteButton").click();
        const quoteMenuRect = document.querySelector("#quoteActionMenu").getBoundingClientRect();
        if (quoteMenuRect.left < 0 || quoteMenuRect.right > innerWidth + 1 || quoteMenuRect.bottom > innerHeight + 1) throw new Error("Le menu du devis déborde à ${viewport.width}px");
        document.querySelector("#moreQuoteButton").click();
        document.querySelector('[data-panel="familyPanel"]').click();
        if (toastRegion.parentElement !== document.body) throw new Error("La notification disparaît lorsque la caisse est masquée à ${viewport.width}px");
        if (toastRegion.getBoundingClientRect().top < topbar.getBoundingClientRect().bottom) throw new Error("La notification recouvre l’en-tête à ${viewport.width}px");
        document.querySelector("#appMenuButton").click();
        const menu = document.querySelector("#appActionsMenu");
        const rect = menu.getBoundingClientRect();
        if (menu.hidden || rect.left < 0 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1) throw new Error("Le menu Actions déborde à ${viewport.width}px");
        document.querySelector("#appMenuButton").click();
      })()`);
    }
    console.log("DESKTOP_PERSISTENCE_SMOKE_OK");
  } finally {
    if (!window.isDestroyed()) window.destroy();
    await app.quit();
    await fs.rm(profileDirectory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  app.quit();
});
