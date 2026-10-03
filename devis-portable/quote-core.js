(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QuoteCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

  function installmentMonths(total) {
    const amount = Math.max(0, Number(total) || 0);
    if (amount <= 0) return [];
    if (amount < 1000) return [3, 4, 6];
    if (amount < 2000) return [3, 4, 6, 10];
    return [3, 4, 6, 10, 12];
  }

  function referenceUnitPrice(line) {
    return line?.offerType === "student"
      ? Number(line.basePrice ?? line.price) || 0
      : Number(line?.price) || 0;
  }

  function referenceLineTotal(line) {
    const paidQuantity = Math.max(0, Number(line?.quantity) || 0);
    const freeQuantity = line?.offerType === "pack" ? Math.max(0, Number(line?.freeQuantity) || 0) : 0;
    return roundMoney(referenceUnitPrice(line) * (paidQuantity + freeQuantity));
  }

  function cleanDocumentPrefix(value, fallback = "DEV") {
    const prefix = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 8);
    return prefix || fallback;
  }

  function relatedDocumentNumber(sourceNumber, requestedPrefix = "FAC") {
    const prefix = cleanDocumentPrefix(requestedPrefix, "FAC");
    const source = String(sourceNumber || "").trim().toUpperCase();
    const suffix = source.match(/(?:^|-)(\d{8}[A-Z0-9-]*\d{3,})$/)?.[1];
    if (suffix) return `${prefix}-${suffix}`;
    const fallbackSuffix = source.replace(/^[A-Z0-9-]+?-/, "").replace(/[^A-Z0-9-]/g, "");
    return fallbackSuffix ? `${prefix}-${fallbackSuffix}` : prefix;
  }

  function paidLineAmount(line) {
    return roundMoney(referenceUnitPrice(line) * Math.max(0, Number(line?.quantity) || 0));
  }

  // Montant sur lequel s’applique le rabais personnalisé : séances payées, après remise étudiante.
  function lineDiscountBase(line, studentRate = 0) {
    const paid = paidLineAmount(line);
    const studentShare = line?.offerType === "student" ? roundMoney(paid * clamp(studentRate, 0, 100) / 100) : 0;
    return roundMoney(Math.max(0, paid - studentShare));
  }

  // Rabais propre à une ligne ; le % n’est pas cumulable avec le tarif étudiant (comme le coupon global).
  function customLineDiscount(line, studentRate = 0) {
    const value = Math.max(0, Number(line?.customDiscount?.value) || 0);
    if (!value) return 0;
    const base = lineDiscountBase(line, studentRate);
    if (line.customDiscount.type === "fixed") return roundMoney(Math.min(base, value));
    if (line.offerType === "student") return 0;
    return roundMoney(base * clamp(value, 0, 100) / 100);
  }

  // Garde-fous du rabais personnalisé. Seuils en part de la ligne (ou du devis pour le cumul) :
  // au-delà de NOTICE un avis s'affiche ; à partir de CONFIRM (ou pour une ligne offerte), une confirmation est exigée.
  const DISCOUNT_GUARD = { notice: 0.10, confirm: 0.30, quoteConfirm: 0.50 };

  function assessLineDiscount(target, lineId, { type = "percent", value = 0 } = {}) {
    const lines = Array.isArray(target?.lines) ? target.lines : [];
    const line = lines.find((item) => item?.id === lineId);
    if (!line) return null;
    const studentRate = calculate(target).studentRate;
    const base = lineDiscountBase(line, studentRate);
    const kind = type === "fixed" ? "fixed" : "percent";
    const requested = Number(value);
    const negative = Number.isFinite(requested) && requested < 0;
    const raw = Number.isFinite(requested) && requested > 0 ? requested : 0;
    const limit = kind === "percent" ? 100 : base;
    const applied = Math.min(limit, raw);
    const draft = { ...line, customDiscount: applied > 0 ? { type: kind, value: applied } : undefined };
    const amount = customLineDiscount(draft, studentRate);
    const share = base > 0 ? amount / base : 0;
    const after = calculate({ ...target, lines: lines.map((item) => item === line ? draft : item) });
    // Part des rabais « au choix » (lignes + coupon) dans le montant restant après les offres automatiques (pack, étudiant).
    const discretionaryBase = Math.max(0, after.subtotal - after.packDiscount - after.studentDiscount);
    const quoteShare = discretionaryBase > 0 ? (after.lineDiscount + after.discount) / discretionaryBase : 0;
    const reasons = [];
    if (negative) reasons.push("negative");
    if (raw > limit) reasons.push(kind === "percent" ? "capped-percent" : "capped-amount");
    const free = amount > 0 && amount >= base;
    if (free) reasons.push("free");
    else if (share >= DISCOUNT_GUARD.confirm) reasons.push("high");
    else if (share > DISCOUNT_GUARD.notice) reasons.push("notice");
    // Le cumul n'est signalé que s'il existe d'autres rabais au choix (autres lignes, coupon) : seul, le rabais de la ligne est déjà annoncé.
    const otherDiscounts = roundMoney(after.lineDiscount - amount + after.discount);
    if (amount > 0 && otherDiscounts > 0 && quoteShare >= DISCOUNT_GUARD.quoteConfirm) reasons.push("quote-high");
    const needsConfirmation = reasons.some((reason) => ["free", "high", "quote-high"].includes(reason));
    return {
      base, applied, amount, share, quoteShare, reasons,
      result: roundMoney(Math.max(0, base - amount)),
      capped: applied !== raw,
      level: needsConfirmation ? "confirm" : reasons.length ? "warn" : ""
    };
  }

  function calculate(target) {
    const lines = Array.isArray(target?.lines) ? target.lines : [];
    const subtotal = roundMoney(lines.reduce((sum, line) => sum + referenceLineTotal(line), 0));
    const packDiscount = roundMoney(lines.reduce((sum, line) => {
      if (line?.offerType !== "pack") return sum;
      return sum + referenceUnitPrice(line) * Math.max(0, Number(line?.freeQuantity) || 0);
    }, 0));
    const studentLines = lines.filter((line) => line?.offerType === "student");
    const hasStudentPricing = studentLines.length > 0;
    const studentRate = hasStudentPricing ? clamp(target?.studentDiscount ?? studentLines[0]?.studentDiscount, 0, 100) : 0;
    const studentBase = roundMoney(studentLines.reduce((sum, line) => sum + paidLineAmount(line), 0));
    const studentDiscount = roundMoney(studentBase * studentRate / 100);
    const lineDiscount = roundMoney(lines.reduce((sum, line) => sum + customLineDiscount(line, studentRate), 0));
    const afterOfferDiscounts = roundMoney(Math.max(0, subtotal - packDiscount - studentDiscount - lineDiscount));
    const rawDiscount = Math.max(0, Number(target?.discount?.value) || 0);
    const discount = target?.discount?.type === "fixed"
      ? Math.min(afterOfferDiscounts, rawDiscount)
      : hasStudentPricing ? 0 : roundMoney(afterOfferDiscounts * clamp(rawDiscount, 0, 100) / 100);
    const discounted = roundMoney(Math.max(0, afterOfferDiscounts - discount));
    const totalDiscount = roundMoney(packDiscount + studentDiscount + lineDiscount + discount);
    let net = discounted;
    let tax = 0;
    let total = discounted;
    const rate = clamp(target?.tax?.rate, 0, 100);
    if (target?.tax?.enabled && rate > 0) {
      if (target.tax.mode === "excluded") {
        tax = roundMoney(discounted * rate / 100);
        total = roundMoney(discounted + tax);
      } else {
        net = roundMoney(discounted / (1 + rate / 100));
        tax = roundMoney(discounted - net);
      }
    }
    return { subtotal, packDiscount, studentDiscount, studentRate, lineDiscount, discount, totalDiscount, discounted, net, tax, total, rate };
  }

  return { roundMoney, clamp, calculate, installmentMonths, referenceLineTotal, lineDiscountBase, customLineDiscount, assessLineDiscount, DISCOUNT_GUARD, cleanDocumentPrefix, relatedDocumentNumber };
});
