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

  function calculate(target) {
    const lines = Array.isArray(target?.lines) ? target.lines : [];
    const paidLineAmount = (line) => roundMoney(referenceUnitPrice(line) * Math.max(0, Number(line?.quantity) || 0));
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
    const afterOfferDiscounts = roundMoney(Math.max(0, subtotal - packDiscount - studentDiscount));
    const rawDiscount = Math.max(0, Number(target?.discount?.value) || 0);
    const discount = target?.discount?.type === "fixed"
      ? Math.min(afterOfferDiscounts, rawDiscount)
      : hasStudentPricing ? 0 : roundMoney(afterOfferDiscounts * clamp(rawDiscount, 0, 100) / 100);
    const discounted = roundMoney(Math.max(0, afterOfferDiscounts - discount));
    const totalDiscount = roundMoney(packDiscount + studentDiscount + discount);
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
    return { subtotal, packDiscount, studentDiscount, studentRate, discount, totalDiscount, discounted, net, tax, total, rate };
  }

  return { roundMoney, clamp, calculate, installmentMonths, referenceLineTotal, cleanDocumentPrefix, relatedDocumentNumber };
});
