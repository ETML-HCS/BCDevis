(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./contact-core.js"));
  else root.BCDevisContactsController = factory(root.BCDevisContacts);
}(typeof globalThis !== "undefined" ? globalThis : this, function (ContactCore) {
  "use strict";

  // Le contrôleur garde uniquement l'état de l'écran et délègue les modifications au service.
  function createController({ document, service, canEditQuote, view, format, maxImportBytes = 10 * 1024 * 1024 }) {
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => [...document.querySelectorAll(selector)];
    const window = document.defaultView;
    const { escapeHTML, normalize, plural, todayISO } = format;
    let selectedContactId = "";
    let contactQuery = "";

    function contactInitials(name) {
      return String(name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "?";
    }

    function fillContactForm(source = {}) {
      const form = $("#clientForm");
      const values = { country: "Suisse", ...source };
      form.reset();
      form.elements.contactId.value = String(values.contactId || values.id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96);
      ContactCore.CONTACT_FIELDS.forEach((field) => { if (form.elements[field]) form.elements[field].value = values[field] || ""; });
      const hasDetails = ["company", "address", "postalCode", "city", "birthDate", "language", "reference", "notes", "source"].some((field) => Boolean(values[field]));
      $("#contactMoreDetails").open = hasDetails;
      $("#contactFormTitle").textContent = selectedContactId ? "Modifier le contact" : values.name ? "Client du devis" : "Nouveau contact";
      $("#deleteContactButton").hidden = !selectedContactId || !service.get(selectedContactId);
    }

    function renderContactDirectory() {
      const contacts = service.list();
      const query = normalize(contactQuery);
      const visible = query ? contacts.filter((contact) => normalize([contact.name, contact.company, contact.phone, contact.email, contact.city, contact.reference].join(" ")).includes(query)) : contacts;
      $("#contactCount").textContent = query ? `${visible.length} / ${plural(contacts.length, "contact")}` : plural(contacts.length, "contact");
      $("#contactEmpty").hidden = visible.length > 0;
      $("#contactEmpty").textContent = contacts.length ? "Aucun résultat." : "Aucun contact. Importez un fichier ou créez le premier.";
      $("#contactList").innerHTML = visible.map((contact) => {
        const detail = contact.company || contact.email || contact.phone || contact.city || "Aucune autre information";
        return `<button class="contact-list-item" type="button" role="option" aria-selected="${contact.id === selectedContactId}" data-contact-id="${escapeHTML(contact.id)}"><span class="contact-list-initials" aria-hidden="true">${escapeHTML(contactInitials(contact.name))}</span><span class="contact-list-copy"><strong>${escapeHTML(contact.name)}</strong><small>${escapeHTML(detail)}</small></span></button>`;
      }).join("");
    }

    function selectContact(contactId, { focusName = false } = {}) {
      const contact = service.get(contactId);
      if (!contact) return;
      selectedContactId = contact.id;
      fillContactForm(contact);
      renderContactDirectory();
      if (focusName) window.setTimeout(() => $("#clientForm").elements.name.focus(), 0);
    }

    function prepareNewContact({ focusName = true } = {}) {
      selectedContactId = "";
      fillContactForm({ country: "Suisse" });
      renderContactDirectory();
      if (focusName) window.setTimeout(() => $("#clientForm").elements.name.focus(), 0);
    }

    function openClient() {
      if (!canEditQuote()) return;
      contactQuery = "";
      $("#contactSearch").value = "";
      const client = service.client();
      const linked = client.contactId && service.get(client.contactId);
      selectedContactId = linked ? linked.id : "";
      fillContactForm(linked || client);
      renderContactDirectory();
      view.open();
      window.setTimeout(() => $("#contactSearch").focus(), 0);
    }

    async function importContactsFromInput(input) {
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;
      if (file.size > maxImportBytes) throw new Error("Le fichier dépasse 10 Mo.");
      const result = service.importFile(file.name, await file.text());
      if (!result) return;
      renderContactDirectory();
      const { added, merged } = result;
      view.toast(`${plural(added, "contact")} ajouté${added === 1 ? "" : "s"}${merged ? ` · ${merged} fusionné${merged === 1 ? "" : "s"}` : ""}`);
    }

    function exportContacts(format) {
      const selected = service.exportFile(format);
      if (!selected) {
        if (!service.list().length) view.toast("Aucun contact à exporter.", "error");
        return;
      }
      view.downloadText(`contacts-bcdevis-${todayISO()}.${selected.extension}`, selected.content, selected.type);
      view.toast(`${plural(selected.count, "contact")} exporté${selected.count === 1 ? "" : "s"}`);
    }

    function bind() {
      $("#clientButton").addEventListener("click", openClient);
      $("#clientForm").addEventListener("submit", (event) => {
        event.preventDefault();
        if (!canEditQuote()) return;
        try {
          const result = service.save(Object.fromEntries(new window.FormData(event.currentTarget)));
          if (!result) return;
          selectedContactId = result.contact.id;
          view.clientChanged();
          view.close();
          view.toast(result.merged ? "Contact fusionné et utilisé" : "Contact enregistré et utilisé");
        } catch (error) {
          view.toast(error.message || "Contact impossible à enregistrer", "error");
        }
      });
      $("#clearClientButton").addEventListener("click", () => {
        if (!canEditQuote() || !service.clearClient()) return;
        view.clientChanged();
        view.close();
        view.toast("Client retiré du devis");
      });
      $("#newContactButton").addEventListener("click", () => prepareNewContact());
      $("#contactSearch").addEventListener("input", (event) => { contactQuery = event.target.value; renderContactDirectory(); });
      $("#contactList").addEventListener("click", (event) => {
        const button = event.target.closest("[data-contact-id]");
        if (button) selectContact(button.dataset.contactId);
      });
      $("#contactImportButton").addEventListener("click", () => $("#contactImportInput").click());
      $("#contactImportInput").addEventListener("change", (event) => void importContactsFromInput(event.target).catch((error) => view.toast(error.message || "Import de contacts impossible", "error")));
      $$('[data-contact-export]').forEach((button) => button.addEventListener("click", () => exportContacts(button.dataset.contactExport)));
      $("#deleteContactButton").addEventListener("click", () => {
        const contact = service.get(selectedContactId);
        if (!contact || !window.confirm(`Supprimer ${contact.name} du répertoire ? Le devis conservera ses coordonnées.`)) return;
        if (!service.remove(selectedContactId)) return;
        prepareNewContact({ focusName: false });
        view.clientChanged();
        view.toast("Contact supprimé du répertoire");
      });
    }

    return { bind, open: openClient };
  }

  return { createController };
}));
