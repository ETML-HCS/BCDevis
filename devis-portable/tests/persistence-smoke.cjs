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
    await window.loadFile(path.resolve(__dirname, "..", "index.html"));
    const initial = await window.webContents.executeJavaScript(`(() => {
      const noTransitions = document.createElement("style");
      noTransitions.textContent = "*{transition:none!important}";
      document.head.append(noTransitions);
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
      if (!document.querySelector("#checkoutPanel").classList.contains("is-full-height")) throw new Error("La caisse doit rester en plein écran sur ordinateur");
      if (!document.documentElement.classList.contains("checkout-focus")) throw new Error("Le mode caisse permanent n’est pas initialisé");
      if (document.querySelector("#checkoutFocusToggle") || document.querySelector("#familyFooter") || document.querySelector(".checkout-actions")) throw new Error("Les anciens bandeaux d’actions doivent être supprimés");
      const checkoutActions = [...document.querySelectorAll(".checkout-primary-actions > button")];
      if (checkoutActions.length !== 3) throw new Error("La caisse doit conserver exactement trois actions rapides");
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
      if (Number.parseFloat(getComputedStyle(document.querySelector("#familyNavTitle")).fontSize) !== 18 || Number.parseFloat(getComputedStyle(document.querySelector("#checkoutTitle")).fontSize) !== 22) throw new Error("Les titres Prestations et Caisse n’ont pas été réduits avec mesure");
      const topbarUtilities = document.querySelector(".topbar-utilities");
      const utilityButtons = [...topbarUtilities.querySelectorAll(".topbar-utility-button")];
      const utilityRect = topbarUtilities.getBoundingClientRect();
      if (topbarUtilities.previousElementSibling !== document.querySelector(".topbar-context") || utilityButtons.length !== 2) throw new Error("Les deux utilitaires ne suivent pas directement le groupe des tarifs");
      if (utilityButtons.some((button) => button.textContent.trim() || !button.querySelector("svg") || !button.dataset.tooltip) || utilityRect.right >= checkoutRect.left) throw new Error("Les utilitaires du header ne sont pas des SVG compacts ou empiètent sur la caisse");
      const menuButton = document.querySelector("#appMenuButton");
      if (menuButton.childElementCount !== 1 || !menuButton.firstElementChild.matches("svg")) throw new Error("Le menu principal n’est pas réduit à son icône");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "m", code: "KeyM", altKey: true, bubbles: true, cancelable: true }));
      if (document.querySelector("#appActionsMenu").hidden) throw new Error("Alt+M n’ouvre pas le menu principal");
      if (document.querySelector("#appActionsMenu .app-menu-status") || document.querySelector("#saveState")) throw new Error("Le menu Actions conserve une ligne d’état inutile");
      const menuRect = document.querySelector("#appActionsMenu").getBoundingClientRect();
      if (menuRect.right >= checkoutRect.left) throw new Error("Le menu Actions est recouvert par la caisse");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "m", code: "KeyM", altKey: true, bubbles: true, cancelable: true }));
      if (!document.querySelector("#appActionsMenu").hidden || document.activeElement !== menuButton) throw new Error("Alt+M ne referme pas proprement le menu principal");
      if (document.querySelector("#appActionsMenu").textContent.includes("Gestion du devis")) throw new Error("La gestion du devis est encore dupliquée dans le menu principal");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "p", code: "KeyP", altKey: true, bubbles: true, cancelable: true }));
      if (!document.querySelector("#familyPanel").classList.contains("show-family-prices") || document.querySelector("#familyPriceToggle").getAttribute("aria-checked") !== "true") throw new Error("Alt+P n’affiche pas les prix");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "p", code: "KeyP", altKey: true, bubbles: true, cancelable: true }));
      if (document.querySelector("#familyPanel").classList.contains("show-family-prices") || document.querySelector("#familyPriceToggle").getAttribute("aria-checked") !== "false") throw new Error("Alt+P ne masque pas les prix");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "N", code: "KeyN", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
      if (document.querySelector("#customItemLayer").hidden) throw new Error("Ctrl+Maj+N n’ouvre pas l’objet sur mesure");
      document.querySelector('#customItemLayer [data-close="customItemLayer"]').click();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "h", code: "KeyH", ctrlKey: true, bubbles: true, cancelable: true }));
      if (document.querySelector("#historyLayer").hidden) throw new Error("Ctrl+H n’ouvre pas l’historique");
      document.querySelector('#historyLayer [data-close="historyLayer"]').click();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "?", code: "Slash", shiftKey: true, bubbles: true, cancelable: true }));
      if (document.querySelector("#shortcutHelpLayer").hidden) throw new Error("? n’ouvre pas l’aide des raccourcis");
      const shortcutCard = document.querySelector(".shortcut-help-modal");
      const shortcutRect = shortcutCard.getBoundingClientRect();
      const shortcutList = shortcutCard.querySelector(".shortcut-list");
      if (shortcutRect.left < 0 || shortcutRect.right > innerWidth + 1 || shortcutRect.bottom > innerHeight + 1) throw new Error("L’aide des raccourcis déborde de la fenêtre");
      if (shortcutList.scrollWidth > shortcutList.clientWidth + 1 || getComputedStyle(shortcutList).gridTemplateColumns.trim().split(/\\s+/).length !== 2) throw new Error("L’aide des raccourcis n’utilise pas correctement ses deux colonnes");
      document.querySelector('#shortcutHelpLayer [data-close="shortcutHelpLayer"]').click();
      if (document.querySelector(".tax-header-toggle").textContent.trim() !== "TVA") throw new Error("Le toggle TVA conserve un libellé inutilement long");
      document.querySelector("#moreQuoteButton").click();
      const quoteMenu = document.querySelector("#quoteActionMenu");
      const quoteMenuRect = quoteMenu.getBoundingClientRect();
      if (quoteMenu.hidden || quoteMenu.querySelectorAll('[role="menuitem"]').length !== 4) throw new Error("Le menu des actions du devis est incomplet");
      if (quoteMenuRect.left < checkoutRect.left || quoteMenuRect.right > checkoutRect.right + 1) throw new Error("Le menu des actions du devis déborde de la caisse");
      document.querySelector("#moreQuoteButton").click();
      const catalogSearch = document.querySelector("#catalogSearch");
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
      if (!convertedPackLine || convertedPackLine.querySelector('[data-quantity-gesture="free"]')?.textContent.trim() !== "1") {
        throw new Error("La conversion en pack ne conserve pas correctement la séance offerte");
      }
      if (/undefined/i.test(document.querySelector("#toastRegion").textContent)) throw new Error("Le message de conversion en pack contient une valeur indéfinie");
      const specialLineName = [...document.querySelectorAll(".cart-line-name")].find((input) => input.value === "Zone spéciale 100 cm²");
      if (!specialLineName) throw new Error("Zone spéciale 100 cm² n’apparaît pas dans la caisse");
      const specialLine = specialLineName.closest(".cart-line");
      const specialControls = specialLine.querySelector(".cart-line-inline-controls");
      const specialCategory = specialLine.querySelector(".cart-line-category");
      const specialNameRect = specialLineName.getBoundingClientRect();
      const specialControlsRect = specialControls.getBoundingClientRect();
      const specialRowRect = specialLine.getBoundingClientRect();
      const specialNameStyle = getComputedStyle(specialLineName);
      if (specialNameRect.right > specialControlsRect.left + 1) throw new Error("Zone spéciale 100 cm² chevauche encore sa catégorie et ses contrôles");
      if (specialControlsRect.right > specialRowRect.right + 1) throw new Error("Les contrôles de Zone spéciale 100 cm² débordent de la caisse");
      if (specialNameStyle.textOverflow !== "ellipsis" || specialNameStyle.overflowX !== "hidden" || specialNameStyle.whiteSpace !== "nowrap") throw new Error("Les prestations longues ne sont pas tronquées avec une ellipse");
      if (specialLineName.scrollWidth <= specialLineName.clientWidth + 1) throw new Error("Zone spéciale 100 cm² n’active pas réellement la troncature prévue");
      if (specialLineName.title !== specialLineName.value || specialCategory.title !== "Poitrine et abdomen") throw new Error("Le libellé complet tronqué n’est pas disponible au survol");
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
      if (Math.max(...actionRects.map((rect) => rect.width)) - Math.min(...actionRects.map((rect) => rect.width)) > 1) throw new Error("Les trois actions rapides doivent avoir la même largeur");
      if (document.querySelector("#couponToggle").textContent.trim() !== "Ajouter un coupon") throw new Error("L’action coupon reste réduite à un signe ambigu");

      document.querySelector("#clientButton").click();
      const client = document.querySelector("#clientForm");
      client.elements.name.value = "Sophie Martin";
      client.elements.phone.value = "+41 79 111 22 33";
      client.elements.email.value = "sophie@example.test";
      client.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      document.querySelector("#checkoutTransmitButton").click();
      if (document.querySelector("#checkoutTransmissionMenu").hidden) throw new Error("Envoyer n’ouvre pas les choix WhatsApp et E-mail");
      if (document.querySelector("#checkoutEmailRecipient").textContent !== "sophie@example.test") throw new Error("Le choix E-mail ne reprend pas l’adresse du contact");
      if (!document.querySelector("#checkoutWhatsAppButton") || !document.querySelector("#checkoutEmailButton")) throw new Error("Un choix de transmission est absent");
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
      settings.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

      document.querySelector("#saveButton").click();
      return {
        client: document.querySelector("#clientName").textContent,
        lines: document.querySelectorAll(".cart-line").length,
        theme: document.documentElement.dataset.theme,
        font: document.documentElement.dataset.font,
        company: document.querySelector(".brand-block .eyebrow")?.textContent || ""
      };
    })()`);
    assert.deepEqual(initial, { client: "Sophie Martin", lines: 5, theme: "bordeaux", font: "roboto-slab", company: "Clinique Bellecour Test" });

    const emailDraft = await window.webContents.executeJavaScript(`(async () => {
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
      document.querySelector("#checkoutTransmitButton").click();
      document.querySelector("#checkoutEmailButton").click();
      for (let attempt = 0; attempt < 20 && !window.__bcdevisEmailPayload; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return {
        payload: window.__bcdevisEmailPayload,
        fallbackUrl: window.__bcdevisFallbackUrl
      };
    })()`);
    assert.equal(emailDraft.payload.to, "sophie@example.test");
    assert.match(emailDraft.payload.attachmentPath, /DEV-\d{8}[A-Z0-9]*\d{3}\.pdf$/);
    assert.match(emailDraft.payload.body, /Sous-total :/);
    assert.match(emailDraft.payload.body, /Total :/);
    assert.doesNotMatch(emailDraft.payload.body, /\+/);
    assert.doesNotMatch(emailDraft.payload.body, /—\s*—| — /);
    assert.equal(emailDraft.fallbackUrl, null, "Outlook ne doit pas être remplacé par mailto lorsque le PDF est joint");

    const emailFailure = await window.webContents.executeJavaScript(`(async () => {
      window.__bcdevisFallbackUrl = null;
      window.bcdevisDesktop.composeEmail = async () => { throw new Error("Client e-mail indisponible"); };
      document.querySelector("#checkoutTransmitButton").click();
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
        savedQuotes: document.querySelectorAll("#historyList [data-quote-id]").length
      };
    })()`);
    assert.match(restored.bodyFont, /Roboto Slab/, "La police sauvegardée doit être appliquée après rechargement");
    delete restored.bodyFont;
    assert.deepEqual(restored, { client: "Sophie Martin", lines: 5, theme: "bordeaux", font: "roboto-slab", company: "Clinique Bellecour Test", savedQuotes: 1 });

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
      const payload = { type: "atelier-devis-backup", version: 17, database: { settings: { companyName: "Clinique sauvegardée", theme: "night", fontFamily: "roboto" }, quotes: { [restoredQuote.id]: restoredQuote }, current: restoredQuote, customServices: [{ id: "custom-backup", name: "Soin sauvegardé", price: 75, duration: 20, categoryId: 1 }] } };
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
    assert.deepEqual(backupRestored, { client: "Sauvegarde vérifiée", lines: 2, theme: "night", font: "roboto", company: "Clinique sauvegardée" });

    await reload(window.webContents);
    const backupAfterReload = await window.webContents.executeJavaScript(`(() => {
      document.querySelector("#historyButton").click();
      return { client: document.querySelector("#clientName").textContent, font: document.documentElement.dataset.font, savedQuotes: document.querySelectorAll("#historyList [data-quote-id]").length };
    })()`);
    assert.deepEqual(backupAfterReload, { client: "Sauvegarde vérifiée", font: "roboto", savedQuotes: 1 });
    await window.webContents.executeJavaScript(`document.querySelector('#historyLayer [data-close="historyLayer"]').click()`);

    for (const viewport of [
      { width: 1180, height: 820, hideBrand: false },
      { width: 760, height: 820, hideBrand: false },
      { width: 390, height: 844, hideBrand: true }
    ]) {
      window.setContentSize(viewport.width, viewport.height);
      await new Promise((resolve) => setTimeout(resolve, 120));
      await window.webContents.executeJavaScript(`(() => {
        const checkout = document.querySelector("#checkoutPanel");
        const brand = document.querySelector(".brand-block");
        const topbar = document.querySelector(".topbar");
        const tariffRect = document.querySelector(".topbar-context").getBoundingClientRect();
        const utilitiesRect = document.querySelector(".topbar-utilities").getBoundingClientRect();
        if (checkout.classList.contains("is-full-height") || document.documentElement.classList.contains("checkout-focus")) throw new Error("La caisse permanente bloque la navigation responsive");
        if (getComputedStyle(document.querySelector("#mobileTabs")).display === "none") throw new Error("La navigation mobile est absente à ${viewport.width}px");
        if (document.documentElement.scrollWidth > innerWidth + 1 || topbar.scrollWidth > topbar.clientWidth + 1) throw new Error("Le header déborde à ${viewport.width}px");
        if (utilitiesRect.left < tariffRect.right - 1 || utilitiesRect.right > topbar.getBoundingClientRect().right + 1) throw new Error("Les utilitaires chevauchent les tarifs à ${viewport.width}px");
        if ((getComputedStyle(brand).display === "none") !== ${viewport.hideBrand}) throw new Error("La marque n’est pas adaptée à ${viewport.width}px");
        document.querySelector('[data-panel="checkoutPanel"]').click();
        const receiptRect = document.querySelector(".receipt-head").getBoundingClientRect();
        const receiptTitleRect = document.querySelector("#checkoutTitle").getBoundingClientRect();
        const receiptActionsRect = document.querySelector("#quoteHeadActions").getBoundingClientRect();
        if (receiptActionsRect.left < receiptTitleRect.right + 4 || receiptActionsRect.right > receiptRect.right + 1) throw new Error("Les actions de l’en-tête de caisse se chevauchent à ${viewport.width}px");
        const quickActions = document.querySelector(".checkout-primary-actions");
        const quickRect = quickActions.getBoundingClientRect();
        const quickButtons = [...quickActions.querySelectorAll(":scope > button")].map((button) => button.getBoundingClientRect());
        if (quickRect.left < 0 || quickRect.right > innerWidth + 1 || quickRect.bottom > innerHeight + 1) throw new Error("Les actions de caisse débordent à ${viewport.width}px");
        if (Math.max(...quickButtons.map((rect) => rect.width)) - Math.min(...quickButtons.map((rect) => rect.width)) > 1) throw new Error("Les actions de caisse sont déséquilibrées à ${viewport.width}px");
        if (document.documentElement.scrollWidth > innerWidth + 1) throw new Error("La caisse crée un défilement horizontal à ${viewport.width}px");
        document.querySelector("#moreQuoteButton").click();
        const quoteMenuRect = document.querySelector("#quoteActionMenu").getBoundingClientRect();
        if (quoteMenuRect.left < 0 || quoteMenuRect.right > innerWidth + 1 || quoteMenuRect.bottom > innerHeight + 1) throw new Error("Le menu du devis déborde à ${viewport.width}px");
        document.querySelector("#moreQuoteButton").click();
        document.querySelector('[data-panel="familyPanel"]').click();
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
