(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BCDevisCurrency = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // Les prix restent établis et calculés en CHF. Le devis en euros n'est qu'un affichage converti :
  //   montant en EUR = montant en CHF ÷ taux du marché × (1 + commission)
  // La commission protège la clinique : si l'euro perd jusqu'à environ la valeur de la commission avant
  // d'être rechangé en francs, elle ne perd rien.
  const RATE_LIMITS = { min: 0.5, max: 2 };
  const COMMISSION_LIMITS = { min: 0, max: 10 };
  const RECOMMENDED_COMMISSION = { min: 2, max: 3 };
  const DEFAULT_COMMISSION = 2.5;
  const STALE_AFTER_DAYS = 7;
  // Taux de référence de la Banque centrale européenne, sans clé d'accès, avec en-têtes CORS.
  const RATE_SOURCE_URL = "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=CHF";

  const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const roundCents = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const roundTo = (value, digits) => Math.round((Number(value) + Number.EPSILON) * 10 ** digits) / 10 ** digits;
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && Number.isFinite(Date.parse(`${value}T12:00:00Z`));

  // Nombre de francs suisses pour 1 euro. La virgule décimale est acceptée ; une valeur absurde est refusée.
  function parseRate(value) {
    const text = String(value ?? "").trim().replace(",", ".");
    if (!text) return null;
    const number = Number(text);
    return Number.isFinite(number) && number >= RATE_LIMITS.min && number <= RATE_LIMITS.max ? roundTo(number, 4) : null;
  }

  function parseCommission(value) {
    const text = String(value ?? "").trim().replace(",", ".");
    if (!text) return null;
    const number = Number(text);
    return Number.isFinite(number) && number >= COMMISSION_LIMITS.min && number <= COMMISSION_LIMITS.max ? roundTo(number, 2) : null;
  }

  // Photographie du taux au moment où le devis passe en euros : un devis envoyé ne change plus quand le taux évolue.
  function makeFx(settings, today) {
    if (!isRecord(settings) || settings.eurEnabled !== true) return null;
    const rate = parseRate(settings.eurRate);
    if (rate === null) return null;
    const commission = parseCommission(settings.eurCommission);
    return {
      code: "EUR",
      rate,
      commission: commission === null ? DEFAULT_COMMISSION : commission,
      date: validDate(settings.eurRateDate) ? String(settings.eurRateDate) : String(today || "")
    };
  }

  function sanitizeFx(source) {
    if (!isRecord(source) || source.code !== "EUR") return null;
    const rate = parseRate(source.rate);
    const commission = parseCommission(source.commission);
    if (rate === null || commission === null || !validDate(source.date)) return null;
    return { code: "EUR", rate, commission, date: String(source.date) };
  }

  function convertFromChf(amount, fx) {
    const target = sanitizeFx(fx);
    const value = Number(amount) || 0;
    if (!target) return roundCents(value);
    return roundCents(value / target.rate * (1 + target.commission / 100));
  }

  // Combien de francs suisses « valent » un euro facturé au client, commission comprise : c'est le taux affiché sur le PDF,
  // celui qui permet au client de vérifier le calcul (CHF ÷ taux).
  function effectiveRate(fx) {
    const target = sanitizeFx(fx);
    return target ? roundTo(target.rate / (1 + target.commission / 100), 4) : null;
  }

  function rateAgeDays(date, today) {
    if (!validDate(date) || !validDate(today)) return null;
    return Math.max(0, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86400000));
  }

  function isStale(date, today) {
    const age = rateAgeDays(date, today);
    return age !== null && age > STALE_AFTER_DAYS;
  }

  function commissionAdvice(commission) {
    const value = parseCommission(commission);
    if (value === null) return "invalid";
    if (value < RECOMMENDED_COMMISSION.min) return "low";
    if (value > RECOMMENDED_COMMISSION.max) return "high";
    return "ok";
  }

  function parseRatePayload(payload) {
    const rate = parseRate(payload?.rates?.CHF);
    if (rate === null) throw new Error("Le service de taux de change a renvoyé une valeur inexploitable.");
    return { rate, date: validDate(payload?.date) ? String(payload.date) : "", source: "ecb" };
  }

  async function fetchEurChfRate(fetchImpl, { signal, url = RATE_SOURCE_URL } = {}) {
    if (typeof fetchImpl !== "function") throw new Error("Connexion réseau indisponible.");
    let response;
    try {
      response = await fetchImpl(url, { headers: { accept: "application/json" }, signal });
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("Le service de taux de change ne répond pas.");
      throw new Error("Taux de change injoignable : vérifiez la connexion Internet ou saisissez le taux à la main.");
    }
    if (!response.ok) throw new Error(`Le service de taux de change a répondu ${response.status}.`);
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error("Le service de taux de change a renvoyé une réponse illisible.");
    }
    return parseRatePayload(payload);
  }

  return {
    RATE_LIMITS,
    COMMISSION_LIMITS,
    RECOMMENDED_COMMISSION,
    DEFAULT_COMMISSION,
    STALE_AFTER_DAYS,
    RATE_SOURCE_URL,
    parseRate,
    parseCommission,
    makeFx,
    sanitizeFx,
    convertFromChf,
    effectiveRate,
    rateAgeDays,
    isStale,
    commissionAdvice,
    parseRatePayload,
    fetchEurChfRate
  };
});
