(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BCDevisPdfI18n = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // Langues du PDF : le nom affiché est celui de la langue elle-même, le nom français sert au répertoire des contacts.
  // « UA » est affiché pour l'ukrainien : « UK » se lirait « Royaume-Uni ».
  const LANGUAGES = [
    { code: "fr", label: "Français", french: "Français", short: "FR", locale: "fr-CH" },
    { code: "en", label: "English", french: "Anglais", short: "EN", locale: "en-GB" },
    { code: "de", label: "Deutsch", french: "Allemand", short: "DE", locale: "de-CH" },
    { code: "it", label: "Italiano", french: "Italien", short: "IT", locale: "it-CH" },
    { code: "es", label: "Español", french: "Espagnol", short: "ES", locale: "es-ES" },
    { code: "pt", label: "Português", french: "Portugais", short: "PT", locale: "pt-PT" },
    { code: "uk", label: "Українська", french: "Ukrainien", short: "UA", locale: "uk-UA" },
    { code: "ru", label: "Русский", french: "Russe", short: "RU", locale: "ru-RU" }
  ];
  const CODES = LANGUAGES.map((language) => language.code);
  const CYRILLIC = new Set(["uk", "ru"]);

  function pluralForm(code, count, forms) {
    const category = new Intl.PluralRules(languageInfo(code).locale).select(Number(count) || 0);
    return forms[category] ?? forms.other;
  }

  const STRINGS = {
    fr: {
      title: "DEVIS",
      contactLabel: "Coordonnées",
      uidLabel: "IDE",
      establishment: "Établissement",
      clientLabel: "Destinataire",
      clientMissing: "Destinataire non renseigné",
      contactMissing: "Coordonnées non renseignées",
      references: "Références",
      quoteDate: "Date du devis",
      validUntil: "Valable jusqu’au",
      currency: "Devise",
      treatments: "Soins",
      thTreatment: "Soin",
      thQuantity: "Quantité",
      thUnitPrice: "Prix unitaire",
      thTotal: "Total",
      totalBeforeOffers: "Total avant offres",
      totalDiscount: "Rabais total",
      netExclVat: "Net HT",
      vat: "TVA",
      vatIncluded: " incluse",
      totalToPay: "Total à payer",
      totalToPayInclVat: "Total à payer TTC",
      discount: "Rabais",
      paymentTerms: "Modalités de paiement",
      installmentIntro: "Les mensualités présentées ci-dessous sont indicatives. Toute demande d’échelonnement est soumise à l’acceptation préalable du partenaire financier.",
      months: () => "mois",
      indicativeInstallment: "mensualité indicative",
      termsAndAcceptance: "Conditions et acceptation",
      paymentConditions: "Conditions de règlement",
      studentConditionsTitle: "Conditions du tarif étudiant",
      dateAndPlace: "Date et lieu",
      signature: "Signature du client et mention « Bon pour accord »",
      singleSession: "Séance unique",
      studentRate: "Tarif étudiant",
      packOffer: (paid, free) => `Pack ${paid} + ${free} offerte${free === 1 ? "" : "s"}`,
      packQuantity: (paid, free) => `${paid} payée${paid === 1 ? "" : "s"} + ${free} offerte${free === 1 ? "" : "s"}`,
      fxNote: (rate, date, reference) => `Prix établis en francs suisses (CHF). Montants convertis en euros au taux de 1 € = ${rate} CHF (taux du ${date}, frais de change inclus). Total de référence : ${reference}.`
    },
    en: {
      title: "QUOTE",
      contactLabel: "Contact details",
      uidLabel: "UID",
      establishment: "Establishment",
      clientLabel: "Client",
      clientMissing: "Client not specified",
      contactMissing: "Contact details not provided",
      references: "References",
      quoteDate: "Quote date",
      validUntil: "Valid until",
      currency: "Currency",
      treatments: "Treatments",
      thTreatment: "Treatment",
      thQuantity: "Quantity",
      thUnitPrice: "Unit price",
      thTotal: "Total",
      totalBeforeOffers: "Total before offers",
      totalDiscount: "Total discount",
      netExclVat: "Net excl. VAT",
      vat: "VAT",
      vatIncluded: " included",
      totalToPay: "Total to pay",
      totalToPayInclVat: "Total to pay incl. VAT",
      discount: "Discount",
      paymentTerms: "Payment terms",
      installmentIntro: "The installments shown below are indicative. Any installment plan is subject to prior acceptance by the financial partner.",
      months: () => "months",
      indicativeInstallment: "indicative installment",
      termsAndAcceptance: "Terms and acceptance",
      paymentConditions: "Payment conditions",
      studentConditionsTitle: "Student rate conditions",
      dateAndPlace: "Date and place",
      signature: "Client signature and “Approved” mention",
      singleSession: "Single session",
      studentRate: "Student rate",
      packOffer: (paid, free) => `Pack ${paid} + ${free} free`,
      packQuantity: (paid, free) => `${paid} paid + ${free} free`,
      fxNote: (rate, date, reference) => `Prices are set in Swiss francs (CHF). Amounts are converted to euros at 1 € = ${rate} CHF (rate of ${date}, exchange fees included). Reference total: ${reference}.`
    },
    // Allemand de Suisse : « Offerte », « MWST » et pas de ß.
    de: {
      title: "OFFERTE",
      contactLabel: "Kontakt",
      uidLabel: "UID",
      establishment: "Einrichtung",
      clientLabel: "Kundin / Kunde",
      clientMissing: "Nicht angegeben",
      contactMissing: "Keine Kontaktangaben",
      references: "Angaben",
      quoteDate: "Datum der Offerte",
      validUntil: "Gültig bis",
      currency: "Währung",
      treatments: "Behandlungen",
      thTreatment: "Behandlung",
      thQuantity: "Anzahl",
      thUnitPrice: "Einzelpreis",
      thTotal: "Total",
      totalBeforeOffers: "Total vor Vergünstigungen",
      totalDiscount: "Rabatt gesamt",
      netExclVat: "Netto exkl. MWST",
      vat: "MWST",
      vatIncluded: " inbegriffen",
      totalToPay: "Total zu bezahlen",
      totalToPayInclVat: "Total zu bezahlen inkl. MWST",
      discount: "Rabatt",
      paymentTerms: "Zahlungsmodalitäten",
      installmentIntro: "Die unten aufgeführten Monatsraten sind unverbindlich. Jede Ratenzahlung setzt die vorgängige Zustimmung des Finanzierungspartners voraus.",
      months: () => "Monate",
      indicativeInstallment: "unverbindliche Monatsrate",
      termsAndAcceptance: "Bedingungen und Annahme",
      paymentConditions: "Zahlungsbedingungen",
      studentConditionsTitle: "Bedingungen des Studierendentarifs",
      dateAndPlace: "Ort und Datum",
      signature: "Unterschrift der Kundin / des Kunden mit dem Vermerk «Gelesen und einverstanden»",
      singleSession: "Einzelsitzung",
      studentRate: "Studierendentarif",
      packOffer: (paid, free) => `Paket ${paid} + ${free} gratis`,
      packQuantity: (paid, free) => `${paid} bezahlt + ${free} gratis`,
      fxNote: (rate, date, reference) => `Preise in Schweizer Franken (CHF). Beträge in Euro umgerechnet zum Kurs von 1 € = ${rate} CHF (Kurs vom ${date}, inkl. Wechselgebühren). Referenzbetrag: ${reference}.`
    },
    it: {
      title: "PREVENTIVO",
      contactLabel: "Contatti",
      uidLabel: "IDI",
      establishment: "Struttura",
      clientLabel: "Cliente",
      clientMissing: "Cliente non indicato",
      contactMissing: "Contatti non indicati",
      references: "Riferimenti",
      quoteDate: "Data del preventivo",
      validUntil: "Valido fino al",
      currency: "Valuta",
      treatments: "Trattamenti",
      thTreatment: "Trattamento",
      thQuantity: "Quantità",
      thUnitPrice: "Prezzo unitario",
      thTotal: "Totale",
      totalBeforeOffers: "Totale prima delle offerte",
      totalDiscount: "Sconto totale",
      netExclVat: "Netto IVA esclusa",
      vat: "IVA",
      vatIncluded: " inclusa",
      totalToPay: "Totale da pagare",
      totalToPayInclVat: "Totale da pagare IVA inclusa",
      discount: "Sconto",
      paymentTerms: "Modalità di pagamento",
      installmentIntro: "Le rate mensili indicate qui sotto sono indicative. Ogni richiesta di pagamento rateale è soggetta all’accettazione preventiva del partner finanziario.",
      months: () => "mesi",
      indicativeInstallment: "rata mensile indicativa",
      termsAndAcceptance: "Condizioni e accettazione",
      paymentConditions: "Condizioni di pagamento",
      studentConditionsTitle: "Condizioni della tariffa studenti",
      dateAndPlace: "Luogo e data",
      signature: "Firma del cliente con la dicitura «Letto e approvato»",
      singleSession: "Seduta singola",
      studentRate: "Tariffa studenti",
      packOffer: (paid, free) => `Pacchetto ${paid} + ${free} in omaggio`,
      packQuantity: (paid, free) => `${paid} a pagamento + ${free} in omaggio`,
      fxNote: (rate, date, reference) => `Prezzi stabiliti in franchi svizzeri (CHF). Importi convertiti in euro al cambio di 1 € = ${rate} CHF (cambio del ${date}, spese di cambio incluse). Totale di riferimento: ${reference}.`
    },
    es: {
      title: "PRESUPUESTO",
      contactLabel: "Contacto",
      uidLabel: "UID",
      establishment: "Centro",
      clientLabel: "Cliente",
      clientMissing: "Cliente no indicado",
      contactMissing: "Datos de contacto no indicados",
      references: "Referencias",
      quoteDate: "Fecha del presupuesto",
      validUntil: "Válido hasta el",
      currency: "Moneda",
      treatments: "Tratamientos",
      thTreatment: "Tratamiento",
      thQuantity: "Cantidad",
      thUnitPrice: "Precio unitario",
      thTotal: "Total",
      totalBeforeOffers: "Total antes de ofertas",
      totalDiscount: "Descuento total",
      netExclVat: "Neto sin IVA",
      vat: "IVA",
      vatIncluded: " incluido",
      totalToPay: "Total a pagar",
      totalToPayInclVat: "Total a pagar IVA incluido",
      discount: "Descuento",
      paymentTerms: "Modalidades de pago",
      installmentIntro: "Las cuotas mensuales indicadas a continuación son orientativas. Toda solicitud de pago a plazos está sujeta a la aceptación previa de la entidad financiera.",
      months: () => "meses",
      indicativeInstallment: "cuota mensual orientativa",
      termsAndAcceptance: "Condiciones y aceptación",
      paymentConditions: "Condiciones de pago",
      studentConditionsTitle: "Condiciones de la tarifa para estudiantes",
      dateAndPlace: "Lugar y fecha",
      signature: "Firma del cliente con la mención «Leído y conforme»",
      singleSession: "Sesión individual",
      studentRate: "Tarifa para estudiantes",
      packOffer: (paid, free) => `Paquete ${paid} + ${free} gratis`,
      packQuantity: (paid, free) => `${paid} de pago + ${free} gratis`,
      fxNote: (rate, date, reference) => `Precios establecidos en francos suizos (CHF). Importes convertidos a euros al tipo de 1 € = ${rate} CHF (tipo del ${date}, gastos de cambio incluidos). Total de referencia: ${reference}.`
    },
    // Portugais européen : la communauté lusophone de Suisse vient surtout du Portugal.
    pt: {
      title: "ORÇAMENTO",
      contactLabel: "Contactos",
      uidLabel: "UID",
      establishment: "Estabelecimento",
      clientLabel: "Cliente",
      clientMissing: "Cliente não indicado",
      contactMissing: "Contactos não indicados",
      references: "Referências",
      quoteDate: "Data do orçamento",
      validUntil: "Válido até",
      currency: "Moeda",
      treatments: "Tratamentos",
      thTreatment: "Tratamento",
      thQuantity: "Quantidade",
      thUnitPrice: "Preço unitário",
      thTotal: "Total",
      totalBeforeOffers: "Total antes das ofertas",
      totalDiscount: "Desconto total",
      netExclVat: "Líquido sem IVA",
      vat: "IVA",
      vatIncluded: " incluído",
      totalToPay: "Total a pagar",
      totalToPayInclVat: "Total a pagar com IVA",
      discount: "Desconto",
      paymentTerms: "Modalidades de pagamento",
      installmentIntro: "As prestações mensais apresentadas abaixo são indicativas. Qualquer pedido de pagamento em prestações está sujeito à aceitação prévia do parceiro financeiro.",
      months: () => "meses",
      indicativeInstallment: "prestação mensal indicativa",
      termsAndAcceptance: "Condições e aceitação",
      paymentConditions: "Condições de pagamento",
      studentConditionsTitle: "Condições da tarifa de estudante",
      dateAndPlace: "Local e data",
      signature: "Assinatura do cliente com a menção «Lido e aceite»",
      singleSession: "Sessão individual",
      studentRate: "Tarifa de estudante",
      packOffer: (paid, free) => `Pack ${paid} + ${free} grátis`,
      packQuantity: (paid, free) => `${paid} ${paid === 1 ? "paga" : "pagas"} + ${free} grátis`,
      fxNote: (rate, date, reference) => `Preços estabelecidos em francos suíços (CHF). Montantes convertidos em euros à taxa de 1 € = ${rate} CHF (taxa de ${date}, custos de câmbio incluídos). Total de referência: ${reference}.`
    },
    uk: {
      title: "КОШТОРИС",
      contactLabel: "Контакти",
      uidLabel: "UID",
      establishment: "Заклад",
      clientLabel: "Клієнт",
      clientMissing: "Клієнта не вказано",
      contactMissing: "Контактні дані не вказано",
      references: "Реквізити",
      quoteDate: "Дата кошторису",
      validUntil: "Дійсний до",
      currency: "Валюта",
      treatments: "Процедури",
      thTreatment: "Процедура",
      thQuantity: "Кількість",
      thUnitPrice: "Ціна за одиницю",
      thTotal: "Сума",
      totalBeforeOffers: "Сума до знижок",
      totalDiscount: "Загальна знижка",
      netExclVat: "Без ПДВ",
      vat: "ПДВ",
      vatIncluded: " включено",
      totalToPay: "До сплати",
      totalToPayInclVat: "До сплати з ПДВ",
      discount: "Знижка",
      paymentTerms: "Умови оплати",
      installmentIntro: "Наведені нижче щомісячні платежі є орієнтовними. Будь-яка розстрочка можлива лише за попередньою згодою фінансового партнера.",
      months: (count) => pluralForm("uk", count, { one: "місяць", few: "місяці", many: "місяців", other: "місяця" }),
      indicativeInstallment: "орієнтовний щомісячний платіж",
      termsAndAcceptance: "Умови та погодження",
      paymentConditions: "Умови розрахунку",
      studentConditionsTitle: "Умови студентського тарифу",
      dateAndPlace: "Дата і місце",
      signature: "Підпис клієнта з позначкою «Погоджено»",
      singleSession: "Разовий сеанс",
      studentRate: "Студентський тариф",
      packOffer: (paid, free) => `Пакет ${paid} + ${free} у подарунок`,
      packQuantity: (paid, free) => `${paid} оплачено + ${free} у подарунок`,
      fxNote: (rate, date, reference) => `Ціни встановлено у швейцарських франках (CHF). Суми переведено в євро за курсом 1 € = ${rate} CHF (курс на ${date}, комісію за обмін включено). Загальна сума в CHF (довідково): ${reference}.`
    },
    ru: {
      title: "СМЕТА",
      contactLabel: "Контакты",
      uidLabel: "UID",
      establishment: "Учреждение",
      clientLabel: "Клиент",
      clientMissing: "Клиент не указан",
      contactMissing: "Контактные данные не указаны",
      references: "Реквизиты",
      quoteDate: "Дата сметы",
      validUntil: "Действительна до",
      currency: "Валюта",
      treatments: "Процедуры",
      thTreatment: "Процедура",
      thQuantity: "Количество",
      thUnitPrice: "Цена за единицу",
      thTotal: "Сумма",
      totalBeforeOffers: "Сумма до скидок",
      totalDiscount: "Общая скидка",
      netExclVat: "Без НДС",
      vat: "НДС",
      vatIncluded: " включён",
      totalToPay: "Итого к оплате",
      totalToPayInclVat: "Итого к оплате с НДС",
      discount: "Скидка",
      paymentTerms: "Условия оплаты",
      installmentIntro: "Приведённые ниже ежемесячные платежи являются ориентировочными. Любая рассрочка возможна только с предварительного согласия финансового партнёра.",
      months: (count) => pluralForm("ru", count, { one: "месяц", few: "месяца", many: "месяцев", other: "месяца" }),
      indicativeInstallment: "ориентировочный ежемесячный платёж",
      termsAndAcceptance: "Условия и согласие",
      paymentConditions: "Условия расчёта",
      studentConditionsTitle: "Условия студенческого тарифа",
      dateAndPlace: "Дата и место",
      signature: "Подпись клиента с отметкой «Согласовано»",
      singleSession: "Разовый сеанс",
      studentRate: "Студенческий тариф",
      packOffer: (paid, free) => `Пакет ${paid} + ${free} в подарок`,
      packQuantity: (paid, free) => `${paid} оплачено + ${free} в подарок`,
      fxNote: (rate, date, reference) => `Цены установлены в швейцарских франках (CHF). Суммы пересчитаны в евро по курсу 1 € = ${rate} CHF (курс на ${date}, комиссия за обмен включена). Итого в CHF (справочно): ${reference}.`
    }
  };

  // Mentions par défaut traduites. Une mention modifiée dans les réglages reste telle qu'elle a été saisie.
  const DEFAULT_TEXTS = {
    payment: {
      en: "Payment is due as treatments are provided or upon purchase of a package. Accepted payment methods are payment cards, cash, TWINT and bank transfer. Any installment payment solution is subject to the prior acceptance of the financial partner.",
      de: "Die Zahlung ist jeweils pro Sitzung oder beim Kauf eines Pakets fällig. Akzeptiert werden Zahlungskarten, Bargeld, TWINT und Banküberweisung. Jede Ratenzahlung setzt die vorgängige Zustimmung des Finanzierungspartners voraus.",
      it: "Il pagamento è dovuto man mano che le sedute vengono effettuate o al momento dell’acquisto di un pacchetto. Sono accettati carte di pagamento, contanti, TWINT e bonifico bancario. Ogni soluzione di pagamento rateale è soggetta all’accettazione preventiva del partner finanziario.",
      es: "El pago se efectúa a medida que se realizan las sesiones o al adquirir un paquete. Se aceptan tarjetas de pago, efectivo, TWINT y transferencia bancaria. Cualquier modalidad de pago a plazos está sujeta a la aceptación previa de la entidad financiera.",
      pt: "O pagamento é devido à medida que as sessões são realizadas ou na compra de um pack. São aceites cartões de pagamento, numerário, TWINT e transferência bancária. Qualquer solução de pagamento em prestações está sujeita à aceitação prévia do parceiro financeiro.",
      uk: "Оплата здійснюється в міру проведення сеансів або під час придбання пакета. Приймаються платіжні картки, готівка, TWINT і банківський переказ. Будь-яка розстрочка можлива лише за попередньою згодою фінансового партнера.",
      ru: "Оплата производится по мере проведения сеансов или при покупке пакета. Принимаются платёжные карты, наличные, TWINT и банковский перевод. Любая рассрочка возможна только с предварительного согласия финансового партнёра."
    },
    student: {
      en: "The student rate is granted upon presentation of a valid student ID.",
      de: "Der Studierendentarif wird gegen Vorlage eines gültigen Studierendenausweises gewährt.",
      it: "La tariffa studenti è concessa su presentazione di un documento studentesco in corso di validità.",
      es: "La tarifa para estudiantes se concede previa presentación de un carné de estudiante vigente.",
      pt: "A tarifa de estudante é concedida mediante apresentação de um comprovativo de estudante válido.",
      uk: "Студентський тариф надається за умови пред’явлення чинного студентського квитка.",
      ru: "Студенческий тариф предоставляется при предъявлении действующего студенческого билета."
    },
    footer: {
      en: "Prices are expressed in Swiss francs. This quote is not an invoice.",
      de: "Preise in Schweizer Franken. Diese Offerte ist keine Rechnung.",
      it: "Prezzi espressi in franchi svizzeri. Il presente preventivo non costituisce fattura.",
      es: "Precios expresados en francos suizos. Este presupuesto no constituye una factura.",
      pt: "Preços expressos em francos suíços. Este orçamento não constitui fatura.",
      uk: "Ціни вказано у швейцарських франках. Цей кошторис не є рахунком.",
      ru: "Цены указаны в швейцарских франках. Настоящая смета не является счётом."
    }
  };

  const CATEGORY_NAMES = {
    en: { 13: "Laser hair removal", 32: "Microneedling · Mesotherapy · Peels", 7: "Initial consultation", 16: "Injection treatments", 17: "Laser treatments", 35: "Combined areas", 15: "Electrolysis hair removal", 9: "Aesthetic medicine with Dr. Poiraud", 20: "Face", 8: "Permanent hair removal", 21: "Chest and abdomen", 22: "Back", 23: "Arms", 24: "Bikini (intimate area)", 25: "Legs", 36: "Students" },
    de: { 13: "Laser-Haarentfernung", 32: "Microneedling · Mesotherapie · Peelings", 7: "Erstkonsultation", 16: "Injektionsbehandlungen", 17: "Laserbehandlungen", 35: "Kombinierte Zonen", 15: "Elektro-Epilation · Elektrolyse", 9: "Ästhetische Medizin mit Dr. Poiraud", 20: "Gesicht", 8: "Dauerhafte Haarentfernung", 21: "Brust und Bauch", 22: "Rücken", 23: "Arme", 24: "Bikinizone (Intimbereich)", 25: "Beine", 36: "Studierende" },
    it: { 13: "Epilazione laser", 32: "Microneedling · Mesoterapia · Peeling", 7: "Prima consulenza", 16: "Trattamenti iniettivi", 17: "Trattamenti laser", 35: "Zone combinate", 15: "Epilazione elettrica · elettrolisi", 9: "Medicina estetica con il Dr. Poiraud", 20: "Viso", 8: "Epilazione definitiva", 21: "Petto e addome", 22: "Schiena", 23: "Braccia", 24: "Inguine (zona intima)", 25: "Gambe", 36: "Studenti" },
    es: { 13: "Depilación láser", 32: "Microneedling · Mesoterapia · Peelings", 7: "Primera consulta", 16: "Tratamientos inyectables", 17: "Tratamientos láser", 35: "Zonas combinadas", 15: "Depilación eléctrica · electrólisis", 9: "Medicina estética con el Dr. Poiraud", 20: "Rostro", 8: "Depilación definitiva", 21: "Pecho y abdomen", 22: "Espalda", 23: "Brazos", 24: "Ingles (zona íntima)", 25: "Piernas", 36: "Estudiantes" },
    pt: { 13: "Depilação a laser", 32: "Microagulhamento · Mesoterapia · Peelings", 7: "Primeira consulta", 16: "Tratamentos injetáveis", 17: "Tratamentos a laser", 35: "Zonas combinadas", 15: "Depilação elétrica · eletrólise", 9: "Medicina estética com o Dr. Poiraud", 20: "Rosto", 8: "Depilação definitiva", 21: "Peito e abdómen", 22: "Costas", 23: "Braços", 24: "Virilha (zona íntima)", 25: "Pernas", 36: "Estudantes" },
    uk: { 13: "Лазерна епіляція", 32: "Мікронідлінг · Мезотерапія · Пілінги", 7: "Первинна консультація", 16: "Ін’єкційні процедури", 17: "Лазерні процедури", 35: "Комбіновані зони", 15: "Електроепіляція · електроліз", 9: "Естетична медицина з доктором Пуаро", 20: "Обличчя", 8: "Перманентна епіляція", 21: "Груди та живіт", 22: "Спина", 23: "Руки", 24: "Бікіні (інтимна зона)", 25: "Ноги", 36: "Студенти" },
    ru: { 13: "Лазерная эпиляция", 32: "Микронидлинг · Мезотерапия · Пилинги", 7: "Первичная консультация", 16: "Инъекционные процедуры", 17: "Лазерные процедуры", 35: "Комбинированные зоны", 15: "Электроэпиляция · электролиз", 9: "Эстетическая медицина с доктором Пуаро", 20: "Лицо", 8: "Перманентная эпиляция", 21: "Грудь и живот", 22: "Спина", 23: "Руки", 24: "Бикини (интимная зона)", 25: "Ноги", 36: "Студенты" }
  };

  // Noms des soins par langue (identifiants de QUOTE_SERVICES). L'anglais reste dans catalog.js (QUOTE_SERVICE_NAMES_EN).
  const minutes = (forms) => ({ 62: forms.under, 61: forms.n(15), 60: forms.n(30), 59: forms.n(45), 58: forms.n(60), ...Object.fromEntries([[112, 10], [113, 15], [114, 20], [115, 30], [116, 45], [118, 60], [119, 90], [120, 120], [121, 150]].map(([id, value]) => [id, `${forms.students} · ${forms.n(value)}`])) });
  const specialZones = (label) => Object.fromEntries([109, 108, 105, 104, 107, 106].map((id) => [id, label]));

  const SERVICE_NAMES = {
    de: {
      102: "Kostenlose, unverbindliche Beratung", 101: "Kostenlose, unverbindliche Beratung", 110: "Nachbehandlung",
      99: "Konsultation bei Dr. Mickaël Poiraud", 97: "Konsultation bei Dr. Mickaël Poiraud", 98: "Konsultation bei Dr. Mickaël Poiraud",
      96: "Haar-Mesotherapie", 95: "Microneedling / Mesotherapie", 94: "Medizinisches Peeling",
      15: "Konsultation für ästhetische Medizin bei Dr. Mickaël Poiraud", 14: "Kostenlose Beratung zur dauerhaften Haarentfernung", 130: "Konsultation für Hauttypen V und VI bei Dr. Poiraud",
      63: "Injektionsbehandlungen", 100: "Nachbehandlung Injektionen", 87: "Botulinumtoxin", 89: "Profhilo-Injektionen", 88: "Hyaluronsäure", 93: "Rejuran",
      90: "Rhinoplastik", 91: "Axilläre Hyperhidrose", 92: "Phalloplastik oder Penoplastik durch Injektion", 80: "Couperose im Gesicht", 81: "Unschöne Gefässe am Körper",
      111: "Oberlippe + Kinn",
      122: "Bikinizone klassisch + Achseln + Gesässfalte", 123: "Bikinizone tief + Achseln + Gesässfalte", 124: "Bikinizone komplett + Achseln + Gesässfalte",
      125: "Unterschenkel, Bikinizone klassisch, Gesässfalte und Achseln", 126: "Unterschenkel, Bikinizone tief, Gesässfalte und Achseln", 127: "Unterschenkel, Bikinizone komplett, Gesässfalte und Achseln",
      128: "Ganze Beine, Bikinizone klassisch, Gesässfalte und Achseln", 129: "Ganze Beine, Bikinizone tief, Gesässfalte und Achseln", 131: "Ganze Beine, Bikinizone komplett, Gesässfalte und Achseln",
      132: "Brust und Bauch", 133: "Brust, Bauch, Hals und Schultern", 134: "Ganzer Rücken, Schultern und Nacken", 135: "Brust, Bauch, Hals, ganzer Rücken, Schultern, Nacken, Achseln und halbe Arme",
      ...minutes({ under: "Weniger als 15 Minuten", n: (value) => `${value} Minuten`, students: "Studierende" }),
      27: "Bart", 30: "Hals", 22: "Zwischen den Augenbrauen", 26: "Wangen", 19: "Oberlippe", 28: "Bartkontur", 20: "Kinn", 25: "Nase und Nasenlöcher", 24: "Ohren", 21: "Augenbrauen", 23: "Schläfen", 29: "Ganzes Gesicht",
      ...specialZones("Spezialzone 100 cm²"),
      33: "Bauch", 32: "Brustwarzenhöfe", 34: "Linea alba", 31: "Brust", 37: "Unterer Rücken", 38: "Ganzer Rücken", 36: "Oberer Rücken", 35: "Nacken",
      41: "Achseln", 43: "Unterarme", 44: "Ganze Arme", 39: "Finger", 42: "Schultern", 40: "Hände",
      45: "Bikinizone klassisch", 46: "Bikinizone tief", 47: "Bikinizone total", 48: "Intimbereich Herren", 49: "Gesässfalte",
      54: "Oberschenkel", 56: "Unterschenkel (inkl. Knie und Füsse)", 55: "Gesäss", 52: "Knie", 57: "Ganze Beine (inkl. Füsse)", 50: "Zehen", 51: "Füsse", 53: "Definierte Oberschenkelzonen"
    },
    it: {
      102: "Consulenza gratuita e senza impegno", 101: "Consulenza gratuita e senza impegno", 110: "Ritocco",
      99: "Consulenza con il Dr. Mickaël Poiraud", 97: "Consulenza con il Dr. Mickaël Poiraud", 98: "Consulenza con il Dr. Mickaël Poiraud",
      96: "Mesoterapia capillare", 95: "Microneedling / Mesoterapia", 94: "Peeling medico",
      15: "Consulenza di medicina estetica con il Dr. Mickaël Poiraud", 14: "Consulenza gratuita per l’epilazione definitiva", 130: "Consulenza fototipi V e VI con il Dr. Poiraud",
      63: "Trattamenti iniettivi", 100: "Ritocco iniezioni", 87: "Tossina botulinica", 89: "Iniezioni di Profhilo", 88: "Acido ialuronico", 93: "Rejuran",
      90: "Rinoplastica", 91: "Iperidrosi ascellare", 92: "Falloplastica o penoplastica iniettiva", 80: "Couperose del viso", 81: "Vasi antiestetici del corpo",
      111: "Labbro superiore + mento",
      122: "Inguine classico + ascelle + solco intergluteo", 123: "Inguine sgambato + ascelle + solco intergluteo", 124: "Inguine completo + ascelle + solco intergluteo",
      125: "Mezze gambe, inguine classico, solco intergluteo e ascelle", 126: "Mezze gambe, inguine sgambato, solco intergluteo e ascelle", 127: "Mezze gambe, inguine completo, solco intergluteo e ascelle",
      128: "Gambe intere, inguine classico, solco intergluteo e ascelle", 129: "Gambe intere, inguine sgambato, solco intergluteo e ascelle", 131: "Gambe intere, inguine completo, solco intergluteo e ascelle",
      132: "Petto e addome", 133: "Petto, addome, collo e spalle", 134: "Schiena intera, spalle e nuca", 135: "Petto, addome, collo, schiena intera, spalle, nuca, ascelle e mezze braccia",
      ...minutes({ under: "Meno di 15 minuti", n: (value) => `${value} minuti`, students: "Studenti" }),
      27: "Barba", 30: "Collo", 22: "Tra le sopracciglia", 26: "Guance", 19: "Labbro superiore", 28: "Contorno barba", 20: "Mento", 25: "Naso e narici", 24: "Orecchie", 21: "Sopracciglia", 23: "Tempie", 29: "Viso intero",
      ...specialZones("Zona speciale 100 cm²"),
      33: "Addome", 32: "Areole", 34: "Linea alba", 31: "Petto", 37: "Zona lombare", 38: "Schiena intera", 36: "Parte alta della schiena", 35: "Nuca",
      41: "Ascelle", 43: "Avambracci", 44: "Braccia intere", 39: "Dita delle mani", 42: "Spalle", 40: "Mani",
      45: "Inguine classico", 46: "Inguine sgambato", 47: "Inguine integrale", 48: "Inguine maschile", 49: "Solco intergluteo",
      54: "Cosce", 56: "Mezze gambe (ginocchia e piedi inclusi)", 55: "Glutei", 52: "Ginocchia", 57: "Gambe intere (piedi inclusi)", 50: "Dita dei piedi", 51: "Piedi", 53: "Zone definite della coscia"
    },
    es: {
      102: "Consulta gratuita y sin compromiso", 101: "Consulta gratuita y sin compromiso", 110: "Retoque",
      99: "Consulta con el Dr. Mickaël Poiraud", 97: "Consulta con el Dr. Mickaël Poiraud", 98: "Consulta con el Dr. Mickaël Poiraud",
      96: "Mesoterapia capilar", 95: "Microneedling / Mesoterapia", 94: "Peeling médico",
      15: "Consulta de medicina estética con el Dr. Mickaël Poiraud", 14: "Consulta gratuita para la depilación definitiva", 130: "Consulta fototipos V y VI con el Dr. Poiraud",
      63: "Tratamientos inyectables", 100: "Retoque de inyecciones", 87: "Toxina botulínica", 89: "Inyecciones de Profhilo", 88: "Ácido hialurónico", 93: "Rejuran",
      90: "Rinoplastia", 91: "Hiperhidrosis axilar", 92: "Faloplastia o penoplastia mediante inyección", 80: "Cuperosis facial", 81: "Vasos antiestéticos del cuerpo",
      111: "Labio superior + mentón",
      122: "Ingles clásicas + axilas + surco interglúteo", 123: "Ingles profundas + axilas + surco interglúteo", 124: "Ingles completas + axilas + surco interglúteo",
      125: "Medias piernas, ingles clásicas, surco interglúteo y axilas", 126: "Medias piernas, ingles profundas, surco interglúteo y axilas", 127: "Medias piernas, ingles completas, surco interglúteo y axilas",
      128: "Piernas completas, ingles clásicas, surco interglúteo y axilas", 129: "Piernas completas, ingles profundas, surco interglúteo y axilas", 131: "Piernas completas, ingles completas, surco interglúteo y axilas",
      132: "Pecho y abdomen", 133: "Pecho, abdomen, cuello y hombros", 134: "Espalda completa, hombros y nuca", 135: "Pecho, abdomen, cuello, espalda completa, hombros, nuca, axilas y medios brazos",
      ...minutes({ under: "Menos de 15 minutos", n: (value) => `${value} minutos`, students: "Estudiantes" }),
      27: "Barba", 30: "Cuello", 22: "Entrecejo", 26: "Mejillas", 19: "Labio superior", 28: "Contorno de la barba", 20: "Mentón", 25: "Nariz y fosas nasales", 24: "Orejas", 21: "Cejas", 23: "Sienes", 29: "Rostro completo",
      ...specialZones("Zona especial 100 cm²"),
      33: "Abdomen", 32: "Areolas", 34: "Línea alba", 31: "Pecho", 37: "Zona lumbar", 38: "Espalda completa", 36: "Parte superior de la espalda", 35: "Nuca",
      41: "Axilas", 43: "Antebrazos", 44: "Brazos completos", 39: "Dedos de las manos", 42: "Hombros", 40: "Manos",
      45: "Ingles clásicas", 46: "Ingles profundas", 47: "Ingles integrales", 48: "Ingles masculinas", 49: "Surco interglúteo",
      54: "Muslos", 56: "Medias piernas (rodillas y pies incluidos)", 55: "Glúteos", 52: "Rodillas", 57: "Piernas completas (pies incluidos)", 50: "Dedos de los pies", 51: "Pies", 53: "Zonas definidas del muslo"
    },
    pt: {
      102: "Consulta gratuita e sem compromisso", 101: "Consulta gratuita e sem compromisso", 110: "Retoque",
      99: "Consulta com o Dr. Mickaël Poiraud", 97: "Consulta com o Dr. Mickaël Poiraud", 98: "Consulta com o Dr. Mickaël Poiraud",
      96: "Mesoterapia capilar", 95: "Microagulhamento / Mesoterapia", 94: "Peeling médico",
      15: "Consulta de medicina estética com o Dr. Mickaël Poiraud", 14: "Consulta gratuita para depilação definitiva", 130: "Consulta para fototipos V e VI com o Dr. Poiraud",
      63: "Tratamentos injetáveis", 100: "Retoque de injeções", 87: "Toxina botulínica", 89: "Injeções de Profhilo", 88: "Ácido hialurónico", 93: "Rejuran",
      90: "Rinoplastia", 91: "Hiperidrose axilar", 92: "Faloplastia ou penoplastia por injeção", 80: "Cuperose do rosto", 81: "Vasos inestéticos do corpo",
      111: "Lábio superior + queixo",
      122: "Virilha clássica + axilas + sulco interglúteo", 123: "Virilha cavada + axilas + sulco interglúteo", 124: "Virilha completa + axilas + sulco interglúteo",
      125: "Meia perna, virilha clássica, sulco interglúteo e axilas", 126: "Meia perna, virilha cavada, sulco interglúteo e axilas", 127: "Meia perna, virilha completa, sulco interglúteo e axilas",
      128: "Perna inteira, virilha clássica, sulco interglúteo e axilas", 129: "Perna inteira, virilha cavada, sulco interglúteo e axilas", 131: "Perna inteira, virilha completa, sulco interglúteo e axilas",
      132: "Peito e abdómen", 133: "Peito, abdómen, pescoço e ombros", 134: "Costas completas, ombros e nuca", 135: "Peito, abdómen, pescoço, costas completas, ombros, nuca, axilas e meio braço",
      ...minutes({ under: "Menos de 15 minutos", n: (value) => `${value} minutos`, students: "Estudantes" }),
      27: "Barba", 30: "Pescoço", 22: "Entre as sobrancelhas", 26: "Bochechas", 19: "Lábio superior", 28: "Contorno da barba", 20: "Queixo", 25: "Nariz e narinas", 24: "Orelhas", 21: "Sobrancelhas", 23: "Têmporas", 29: "Rosto completo",
      ...specialZones("Zona especial 100 cm²"),
      33: "Abdómen", 32: "Aréolas", 34: "Linha alba", 31: "Peito", 37: "Zona lombar", 38: "Costas completas", 36: "Parte superior das costas", 35: "Nuca",
      41: "Axilas", 43: "Antebraços", 44: "Braços completos", 39: "Dedos das mãos", 42: "Ombros", 40: "Mãos",
      45: "Virilha clássica", 46: "Virilha cavada", 47: "Virilha integral", 48: "Virilha masculina", 49: "Sulco interglúteo",
      54: "Coxas", 56: "Meia perna (joelhos e pés incluídos)", 55: "Nádegas", 52: "Joelhos", 57: "Perna inteira (pés incluídos)", 50: "Dedos dos pés", 51: "Pés", 53: "Zonas definidas da coxa"
    },
    uk: {
      102: "Безкоштовна консультація без зобов’язань", 101: "Безкоштовна консультація без зобов’язань", 110: "Корекція",
      99: "Консультація доктора Мікаеля Пуаро", 97: "Консультація доктора Мікаеля Пуаро", 98: "Консультація доктора Мікаеля Пуаро",
      96: "Мезотерапія шкіри голови", 95: "Мікронідлінг / мезотерапія", 94: "Медичний пілінг",
      15: "Консультація з естетичної медицини доктора Мікаеля Пуаро", 14: "Безкоштовна консультація щодо перманентної епіляції", 130: "Консультація для фототипів V і VI доктора Пуаро",
      63: "Ін’єкційні процедури", 100: "Корекція після ін’єкцій", 87: "Ботулінічний токсин", 89: "Ін’єкції Profhilo", 88: "Гіалуронова кислота", 93: "Rejuran",
      90: "Ринопластика", 91: "Гіпергідроз пахв", 92: "Ін’єкційна фалопластика або пенопластика", 80: "Купероз обличчя", 81: "Судинні сітки на тілі",
      111: "Верхня губа + підборіддя",
      122: "Класичне бікіні + пахви + міжсіднична складка", 123: "Глибоке бікіні + пахви + міжсіднична складка", 124: "Повне бікіні + пахви + міжсіднична складка",
      125: "Гомілки, класичне бікіні, міжсіднична складка та пахви", 126: "Гомілки, глибоке бікіні, міжсіднична складка та пахви", 127: "Гомілки, повне бікіні, міжсіднична складка та пахви",
      128: "Ноги повністю, класичне бікіні, міжсіднична складка та пахви", 129: "Ноги повністю, глибоке бікіні, міжсіднична складка та пахви", 131: "Ноги повністю, повне бікіні, міжсіднична складка та пахви",
      132: "Груди та живіт", 133: "Груди, живіт, шия та плечі", 134: "Спина повністю, плечі та шия ззаду", 135: "Груди, живіт, шия, спина повністю, плечі, шия ззаду, пахви та половина рук",
      ...minutes({ under: "Менше 15 хвилин", n: (value) => `${value} хвилин`, students: "Студенти" }),
      27: "Борода", 30: "Шия", 22: "Міжбрів’я", 26: "Щоки", 19: "Верхня губа", 28: "Контур бороди", 20: "Підборіддя", 25: "Ніс і ніздрі", 24: "Вуха", 21: "Брови", 23: "Скроні", 29: "Обличчя повністю",
      ...specialZones("Спеціальна зона 100 см²"),
      33: "Живіт", 32: "Ареоли", 34: "Біла лінія живота", 31: "Груди", 37: "Поперек", 38: "Спина повністю", 36: "Верхня частина спини", 35: "Шия ззаду",
      41: "Пахви", 43: "Передпліччя", 44: "Руки повністю", 39: "Пальці рук", 42: "Плечі", 40: "Кисті рук",
      45: "Класичне бікіні", 46: "Глибоке бікіні", 47: "Тотальне бікіні", 48: "Чоловіче бікіні", 49: "Міжсіднична складка",
      54: "Стегна", 56: "Гомілки (коліна та стопи включно)", 55: "Сідниці", 52: "Коліна", 57: "Ноги повністю (стопи включно)", 50: "Пальці ніг", 51: "Стопи", 53: "Окремі зони стегна"
    },
    ru: {
      102: "Бесплатная консультация без обязательств", 101: "Бесплатная консультация без обязательств", 110: "Коррекция",
      99: "Консультация доктора Микаэля Пуаро", 97: "Консультация доктора Микаэля Пуаро", 98: "Консультация доктора Микаэля Пуаро",
      96: "Мезотерапия кожи головы", 95: "Микронидлинг / мезотерапия", 94: "Медицинский пилинг",
      15: "Консультация по эстетической медицине доктора Микаэля Пуаро", 14: "Бесплатная консультация по перманентной эпиляции", 130: "Консультация для фототипов V и VI доктора Пуаро",
      63: "Инъекционные процедуры", 100: "Коррекция после инъекций", 87: "Ботулотоксин", 89: "Инъекции Profhilo", 88: "Гиалуроновая кислота", 93: "Rejuran",
      90: "Ринопластика", 91: "Гипергидроз подмышек", 92: "Инъекционная фаллопластика или пенопластика", 80: "Купероз лица", 81: "Сосудистые сетки на теле",
      111: "Верхняя губа + подбородок",
      122: "Классическое бикини + подмышки + межъягодичная складка", 123: "Глубокое бикини + подмышки + межъягодичная складка", 124: "Полное бикини + подмышки + межъягодичная складка",
      125: "Голени, классическое бикини, межъягодичная складка и подмышки", 126: "Голени, глубокое бикини, межъягодичная складка и подмышки", 127: "Голени, полное бикини, межъягодичная складка и подмышки",
      128: "Ноги полностью, классическое бикини, межъягодичная складка и подмышки", 129: "Ноги полностью, глубокое бикини, межъягодичная складка и подмышки", 131: "Ноги полностью, полное бикини, межъягодичная складка и подмышки",
      132: "Грудь и живот", 133: "Грудь, живот, шея и плечи", 134: "Спина полностью, плечи и шея сзади", 135: "Грудь, живот, шея, спина полностью, плечи, шея сзади, подмышки и половина рук",
      ...minutes({ under: "Менее 15 минут", n: (value) => `${value} минут`, students: "Студенты" }),
      27: "Борода", 30: "Шея", 22: "Межбровье", 26: "Щёки", 19: "Верхняя губа", 28: "Контур бороды", 20: "Подбородок", 25: "Нос и ноздри", 24: "Уши", 21: "Брови", 23: "Виски", 29: "Лицо полностью",
      ...specialZones("Специальная зона 100 см²"),
      33: "Живот", 32: "Ареолы", 34: "Белая линия живота", 31: "Грудь", 37: "Поясница", 38: "Спина полностью", 36: "Верхняя часть спины", 35: "Шея сзади",
      41: "Подмышки", 43: "Предплечья", 44: "Руки полностью", 39: "Пальцы рук", 42: "Плечи", 40: "Кисти рук",
      45: "Классическое бикини", 46: "Глубокое бикини", 47: "Тотальное бикини", 48: "Мужское бикини", 49: "Межъягодичная складка",
      54: "Бёдра", 56: "Голени (колени и стопы включены)", 55: "Ягодицы", 52: "Колени", 57: "Ноги полностью (стопы включены)", 50: "Пальцы ног", 51: "Стопы", 53: "Отдельные зоны бедра"
    }
  };

  function normalizeLanguage(value) {
    const code = String(value || "").trim().toLowerCase();
    return CODES.includes(code) ? code : "fr";
  }

  function languageInfo(value) {
    const code = normalizeLanguage(value);
    return LANGUAGES.find((language) => language.code === code);
  }

  // Langue d'un contact (« Italien », « Italiano », « it ») → code du PDF, ou "" si elle n'est pas proposée.
  function languageFromName(value) {
    const needle = String(value || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (!needle) return "";
    const match = LANGUAGES.find((language) => [language.code, language.french, language.label]
      .some((candidate) => candidate.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") === needle));
    return match ? match.code : "";
  }

  function nextLanguage(value) {
    const index = CODES.indexOf(normalizeLanguage(value));
    return CODES[(index + 1) % CODES.length];
  }

  function strings(value) {
    return STRINGS[normalizeLanguage(value)];
  }

  function usesCyrillic(value) {
    return CYRILLIC.has(normalizeLanguage(value));
  }

  function formatMoney(amount, value, currency = "CHF") {
    return new Intl.NumberFormat(languageInfo(value).locale, {
      style: "currency", currency: currency === "EUR" ? "EUR" : "CHF", currencyDisplay: "narrowSymbol", minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(Number(amount) || 0).replace(/\u202f/g, "\u00a0");
  }

  function formatNumber(number, value, options = {}) {
    return Number(number || 0).toLocaleString(languageInfo(value).locale, options).replace(/\u202f/g, "\u00a0");
  }

  function categoryName(id, fallback, value) {
    const code = normalizeLanguage(value);
    if (code === "fr") return fallback;
    return CATEGORY_NAMES[code]?.[id] || fallback;
  }

  function serviceName(serviceId, fallback, value, englishNames = {}) {
    const code = normalizeLanguage(value);
    if (code === "fr") return fallback;
    const names = code === "en" ? englishNames : SERVICE_NAMES[code];
    return names?.[serviceId] || fallback;
  }

  function defaultText(kind, value) {
    return DEFAULT_TEXTS[kind]?.[normalizeLanguage(value)] || "";
  }

  return {
    LANGUAGES,
    CODES,
    SERVICE_NAMES,
    CATEGORY_NAMES,
    normalizeLanguage,
    languageInfo,
    languageFromName,
    nextLanguage,
    strings,
    usesCyrillic,
    formatMoney,
    formatNumber,
    categoryName,
    serviceName,
    defaultText
  };
});
