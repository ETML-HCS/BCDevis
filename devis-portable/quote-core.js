(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.QuoteCore = api;
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

  function calculate(target) {
    const lines = Array.isArray(target?.lines) ? target.lines : [];
    const lineAmount = (line) => {
      const unitPrice = line?.offerType === "student" ? Number(line.basePrice ?? line.price) || 0 : Number(line?.price) || 0;
      return unitPrice * (Number(line?.quantity) || 0);
    };
    const subtotal = roundMoney(lines.reduce((sum, line) => sum + lineAmount(line), 0));
    const studentLines = lines.filter((line) => line?.offerType === "student");
    const hasStudentPricing = studentLines.length > 0;
    const studentRate = hasStudentPricing ? clamp(target?.studentDiscount ?? studentLines[0]?.studentDiscount, 0, 100) : 0;
    const studentBase = roundMoney(studentLines.reduce((sum, line) => sum + lineAmount(line), 0));
    const studentDiscount = roundMoney(studentBase * studentRate / 100);
    const afterStudentDiscount = roundMoney(Math.max(0, subtotal - studentDiscount));
    const rawDiscount = Math.max(0, Number(target?.discount?.value) || 0);
    const discount = target?.discount?.type === "fixed"
      ? Math.min(afterStudentDiscount, rawDiscount)
      : hasStudentPricing ? 0 : roundMoney(subtotal * clamp(rawDiscount, 0, 100) / 100);
    const discounted = roundMoney(Math.max(0, afterStudentDiscount - discount));
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
    return { subtotal, studentDiscount, studentRate, discount, discounted, net, tax, total, rate };
  }

  return { roundMoney, clamp, calculate, installmentMonths };
});
