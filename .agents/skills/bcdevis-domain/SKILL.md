---
name: bcdevis-domain
description: >-
  Règles métier de BCDevis : logique de calcul financier des devis, tarifs (séance, pack, étudiant -50%), rabais personnalisés par ligne, taxes TVA, cycle de vie du suivi commercial et gestion des contacts.
---

# BCDevis — Connaissances et Règles Métier

## 1. Moteur de Calcul Financier (`QuoteCore.calculate`)

Le calcul financier d'un devis est centralisé dans `devis-portable/quote-core.js`.

### Types de tarification (`offerType`) :
- `"single"` (ou séance unitaire) : prix standard = `line.price * line.quantity`.
- `"pack"` (forfait) : contient des séances payantes (`line.quantity`) et des séances offertes (`line.freeQuantity`, ex: 6+1 offert). Le total de référence inclut le prix théorique des séances offertes, puis la déduction forfaitaire `packDiscount` est soustraite.
- `"student"` (tarif étudiant) : applique un pourcentage de remise (par défaut 50 %) sur le prix de base (`basePrice`).

### Ordre de déduction des remises :
1. `packDiscount` : montant des séances offertes dans les packs.
2. `studentDiscount` : remise étudiante (si applicable).
3. `lineDiscount` : rabais personnalisé spécifique à chaque ligne (`customDiscount`), soit en montant fixe (CHF), soit en pourcentage (%). Le pourcentage n'est pas cumulable avec le tarif étudiant.
4. `discount` : rabais commercial global appliqué sur le restant après remises d'offres.

### Calcul de la TVA / Taxe :
- Mode `"included"` (TTC) : Le montant total reste inchangé ; `tax` est extrait du montant via `tax = total - total / (1 + rate / 100)`.
- Mode `"excluded"` (HT) : `tax = total * (rate / 100)`, puis ajouté au total.

---

## 2. Cycle de Vie du Suivi Commercial (`TrackingCore`)

Chaque devis peut posséder un état de suivi :
- **Transitions autorisées :**
  - `draft` -> `ready`
  - `ready` -> `sent` ou `expired`
  - `sent` -> `accepted`, `refused` ou `expired`
  - `accepted` -> `invoiced`
  - `refused`, `expired`, `invoiced` sont des états terminaux.
- **Révisions liées :** Lorsqu'un devis terminal est modifié, l'application génère une nouvelle révision (V2) liée par `rootQuoteId` plutôt que d'écraser le devis d'origine.
- **Conversions :** Une opportunité est considérée convertie dès lors qu'un de ses devis passe à l'état `accepted` ou `invoiced`.

---

## 3. Gestion des Contacts (`ContactCore`)

- **Champs principaux :** `name`, `phone`, `email`, `company`, `address`, `postalCode`, `city`, `country`, `birthDate`, `language`, `reference`, `notes`.
- **Dédoublonnage :** Basé sur la normalisation des noms, numéros de téléphone et adresses e-mail.
- **Formats supportés :** Export/import CSV avec entêtes français, vCard 3.0 / 4.0, et JSON natif.
