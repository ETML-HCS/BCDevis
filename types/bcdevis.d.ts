/**
 * Types TypeScript et JSDoc pour BCDevis
 * Permet l'inférence de types, l'autocomplétion et la prévention des hallucinations d'IA.
 */

export type OfferType = "single" | "pack" | "student";

export type CustomDiscountType = "percent" | "fixed";

export interface CustomDiscount {
  type: CustomDiscountType;
  value: number;
}

/** Coupon du devis : rabais global, appliqué après les offres et les rabais de ligne. */
export interface QuoteCoupon extends CustomDiscount {
  /** Majuscules, chiffres, « _ » et « - », 24 caractères au plus ; imprimé sur le PDF quand le coupon réduit le devis. */
  code?: string;
}

export type TaxMode = "included" | "excluded";

export interface TaxConfig {
  enabled: boolean;
  rate: number;
  mode: TaxMode;
}

export interface QuoteLine {
  id: string;
  name: string;
  nameEn?: string;
  category?: string;
  categoryId?: number;
  price: number;
  basePrice?: number;
  quantity: number;
  freeQuantity?: number;
  offerType: OfferType;
  customDiscount?: CustomDiscount;
  studentDiscount?: number;
  notes?: string;
}

export interface CalculationResult {
  subtotal: number;
  packDiscount: number;
  studentDiscount: number;
  studentRate: number;
  lineDiscount: number;
  discount: number;
  totalDiscount: number;
  discounted: number;
  net: number;
  tax: number;
  total: number;
  rate: number;
}

export type TrackingStatus =
  | "draft"
  | "ready"
  | "sent"
  | "accepted"
  | "refused"
  | "expired"
  | "invoiced";

export type TrackingLossReason =
  | "price"
  | "timing"
  | "thinking"
  | "no-answer"
  | "competitor"
  | "abandoned"
  | "duplicate"
  | "other";

export interface TrackingEvent {
  id: string;
  /** "contact" = relance confirmée comme effectuée ; seule celle-ci compte dans les statistiques. */
  type: "status" | "note" | "follow-up" | "contact";
  status: TrackingStatus;
  at: string;
  note?: string;
  channel?: string;
  followUpAt?: string;
  reason?: TrackingLossReason | "";
  actor?: string;
  device?: string;
}

export interface QuoteTracking {
  status: TrackingStatus;
  nextFollowUpAt: string;
  sentAt?: string;
  acceptedAt?: string;
  invoicedAt?: string;
  refusedAt?: string;
  expiredAt?: string;
  /** Renseigné uniquement pour les statuts "refused" et "expired". */
  lossReason?: TrackingLossReason | "";
  events: TrackingEvent[];
}

export interface ClientData {
  id?: string;
  contactId?: string;
  name?: string;
  company?: string;
  phone?: string;
  email?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  birthDate?: string;
  language?: string;
  reference?: string;
  notes?: string;
}

export interface Quote {
  id: string;
  number: string;
  date: string;
  validUntil: string;
  client: ClientData;
  lines: QuoteLine[];
  discount?: QuoteCoupon;
  studentDiscount?: number;
  tax?: TaxConfig;
  conditions?: string;
  studentConditions?: string;
  footerNote?: string;
  paymentConditions?: string;
  tracking?: QuoteTracking;
  /** Présent seulement pour un devis en euros : photographie du taux au moment du passage en euros. Les prix restent en CHF. */
  fx?: { code: "EUR"; rate: number; commission: number; date: string };
  revisionNumber?: number;
  rootQuoteId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Contact extends ClientData {
  id: string;
  /** Provenance : premier canal connu (site internet, Google Ads…), conservé lors des fusions. */
  source?: string;
  /** Demande reçue hors de BCDevis (export du site) : ouverte si `requestedAt` > `requestHandledAt` et sans devis créé depuis. */
  request?: string;
  requestedAt?: string;
  requestHandledAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Opérations du répertoire, sans DOM. Les accès à l'état sont relus à chaque opération. */
export interface ContactServiceOptions {
  getDatabase: () => DatabaseState;
  getQuote: () => Quote;
  persist: (touchCurrent?: boolean) => boolean;
  sanitizeClientSnapshot: (source: Partial<Contact> & { contactId?: string }) => ClientData;
  emptyClientSnapshot: () => ClientData;
  idFactory?: () => string;
  maxContacts?: number;
}

export interface ContactService {
  list(): Contact[];
  get(id: string): Contact | undefined;
  client(): ClientData;
  /** null si l'écriture échoue ; conserve alors le répertoire et le client précédents. */
  save(data: Partial<Contact>): { contact: Contact; merged: boolean } | null;
  importContacts(contacts: Partial<Contact>[]): { added: number; merged: number } | null;
  importFile(filename: string, text: string): { added: number; merged: number } | null;
  remove(id: string): boolean;
  clearClient(): boolean;
  exportFile(format: string): { extension: string; type: string; content: string; count: number } | null;
}

export interface PrestationCategory {
  id: number;
  name: string;
  short: string;
  icon: string;
  tone: string;
}

export interface PrestationItem {
  id: number;
  categoryId: number;
  name: string;
  nameEn?: string;
  price: number;
  duration?: number;
  mode?: string;
  description?: string;
  custom?: boolean;
}

export interface AppSettings {
  companyName: string;
  companySubtitle: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyUid: string;
  headerLogoDataUrl: string;
  pdfLogoDataUrl: string;
  quotePrefix: string;
  invoicePrefix: string;
  machineName: string;
  theme: "white" | "dark" | "sand" | "slate";
  fontFamily: "red-hat" | "roboto" | "roboto-slab" | "system";
  validityDays: number;
  packPaidDefault: number;
  packFreeDefault: number;
  studentDiscount: number;
  taxRate: number;
  taxMode: TaxMode;
  showTaxInformation: boolean;
  showFamilyPrices: boolean;
  skipTariffChangeConfirmation: boolean;
  catalogMode: "tiles" | "mannequin";
  ipadLayoutMode: "auto" | "always" | "off";
  displayMode: "auto" | "smartphone" | "full";
  launchAtLogin: boolean;
  visibleFamilies: string[];
  quoteDateEditable: boolean;
  quoteTrackingEnabled: boolean;
  trackingDefaultFollowUpDays: number;
  trackingRemindersOnStartup: boolean;
  trackingShowFilters: boolean;
  conditions: string;
  studentConditions: string;
  footerNote: string;
  showSignatures: boolean;
  /** Langue du PDF : fr, en, de (Suisse), it, es, pt, uk, ru. Voir devis-portable/pdf-i18n.js. */
  pdfLanguage: "fr" | "en" | "de" | "it" | "es" | "pt" | "uk" | "ru";
  /** Devis en euros : proposer le choix CHF / EUR dans la caisse. Voir devis-portable/currency-core.js. */
  eurEnabled: boolean;
  /** Taux du marché : nombre de francs suisses pour 1 €. */
  eurRate: number;
  /** Commission de change ajoutée au prix en euros, en % (2 à 3 % conseillés). */
  eurCommission: number;
  eurAutoUpdate: boolean;
  /** Date du taux (AAAA-MM-JJ) et son origine : « ecb » (Banque centrale européenne) ou « manual ». */
  eurRateDate: string;
  eurRateSource: "" | "ecb" | "manual";
  centralUniqueQuoteNumbers: boolean;
  /** false (défaut) : « À faire » et « Tous les devis » en tableau ; true : en cartes. */
  historyCardView: boolean;
  /** false (défaut) : fiches de suivi simplifiées, actions secondaires derrière le bouton ⋯. */
  trackingDetailedView: boolean;
}

export interface SharedSnapshot {
  quoteCounters: Record<string, number>;
  settings: Partial<AppSettings>;
  customServices: PrestationItem[];
  catalogOverrides: Record<string, Partial<PrestationItem>>;
  contacts: Record<string, Contact>;
  quotes: Record<string, Quote>;
}

export interface DatabaseState {
  version: number;
  sequence: number;
  quoteCounters: Record<string, number>;
  settings: AppSettings;
  customServices: PrestationItem[];
  catalogOverrides: Record<string, Partial<PrestationItem>>;
  contacts: Record<string, Contact>;
  quotes: Record<string, Quote>;
  current: Quote | null;
}
