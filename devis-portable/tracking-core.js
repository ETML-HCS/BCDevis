(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BCDevisTracking = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const CONVERTED_STATUSES = new Set(["accepted", "invoiced"]);

  function timestamp(value) {
    const time = Date.parse(value || "");
    return Number.isFinite(time) ? time : null;
  }

  function datePart(value) {
    const time = timestamp(value);
    return time === null ? "" : new Date(time).toISOString().slice(0, 10);
  }

  function eventDate(item, statuses) {
    const events = Array.isArray(item?.tracking?.events) ? item.tracking.events : [];
    const dates = events
      .filter((event) => event?.type === "status" && statuses.includes(event.status))
      .map((event) => timestamp(event.at))
      .filter((value) => value !== null);
    return dates.length ? new Date(Math.min(...dates)).toISOString() : "";
  }

  function milestoneDate(item, field, statuses) {
    const explicit = timestamp(item?.tracking?.[field]);
    if (explicit !== null) return new Date(explicit).toISOString();
    const fromEvents = eventDate(item, statuses);
    if (fromEvents) return fromEvents;
    return statuses.includes(item?.tracking?.status) && timestamp(item?.updatedAt) !== null
      ? new Date(timestamp(item.updatedAt)).toISOString()
      : "";
  }

  function opportunityKey(item) {
    return String(item?.rootQuoteId || item?.id || "");
  }

  function versionOrder(left, right) {
    const revisionDifference = (Number(left?.revisionNumber) || 1) - (Number(right?.revisionNumber) || 1);
    if (revisionDifference) return revisionDifference;
    return (timestamp(left?.createdAt) || 0) - (timestamp(right?.createdAt) || 0);
  }

  function earliestDate(items, field, statuses) {
    const dates = items.map((item) => milestoneDate(item, field, statuses)).filter(Boolean);
    return dates.sort()[0] || "";
  }

  function latestVersionWith(items, predicate) {
    return [...items].reverse().find(predicate) || null;
  }

  function safeAmount(amountOf, item) {
    const amount = Number(amountOf(item));
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
  }

  function consolidateOpportunities(quotes, { amountOf = () => 0 } = {}) {
    const groups = new Map();
    (Array.isArray(quotes) ? quotes : []).forEach((item) => {
      const key = opportunityKey(item);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });

    return [...groups.entries()].map(([id, versions]) => {
      versions.sort(versionOrder);
      const latest = versions[versions.length - 1];
      const sentAt = earliestDate(versions, "sentAt", ["sent"]);
      const acceptedAt = earliestDate(versions, "acceptedAt", ["accepted"]);
      const invoicedAt = earliestDate(versions, "invoicedAt", ["invoiced"]);
      const refusedAt = earliestDate(versions, "refusedAt", ["refused"]);
      const converted = Boolean(acceptedAt) || versions.some((item) => CONVERTED_STATUSES.has(item?.tracking?.status));
      const invoiced = Boolean(invoicedAt) || versions.some((item) => item?.tracking?.status === "invoiced");
      const acceptedVersion = latestVersionWith(versions, (item) => Boolean(milestoneDate(item, "acceptedAt", ["accepted"])) || CONVERTED_STATUSES.has(item?.tracking?.status));
      const sentVersion = latestVersionWith(versions, (item) => Boolean(milestoneDate(item, "sentAt", ["sent"])));
      const latestStatus = String(latest?.tracking?.status || "draft");

      return {
        id,
        versions,
        latest,
        latestStatus,
        sentAt,
        acceptedAt,
        invoicedAt,
        refusedAt,
        converted,
        invoiced,
        pending: Boolean(sentAt) && !converted && !["refused", "expired"].includes(latestStatus),
        sentAmount: safeAmount(amountOf, sentVersion || latest),
        acceptedAmount: converted ? safeAmount(amountOf, acceptedVersion || latest) : 0
      };
    });
  }

  function median(values) {
    const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function daysBetween(from, to) {
    const start = timestamp(from);
    const end = timestamp(to);
    return start === null || end === null || end < start ? null : (end - start) / 86400000;
  }

  function summarizeConversion(quotes, { startDate = "", endDate = "", amountOf = () => 0 } = {}) {
    const opportunities = consolidateOpportunities(quotes, { amountOf }).filter((item) => {
      const sentDate = datePart(item.sentAt);
      return sentDate && (!startDate || sentDate >= startDate) && (!endDate || sentDate <= endDate);
    });
    const converted = opportunities.filter((item) => item.converted);
    const total = (field) => opportunities.reduce((sum, item) => sum + Number(item[field] || 0), 0);
    const acceptanceDelays = converted.map((item) => daysBetween(item.sentAt, item.acceptedAt));

    return {
      sent: opportunities.length,
      converted: converted.length,
      refused: opportunities.filter((item) => !item.converted && item.latestStatus === "refused").length,
      expired: opportunities.filter((item) => !item.converted && item.latestStatus === "expired").length,
      pending: opportunities.filter((item) => item.pending).length,
      conversionRate: opportunities.length ? converted.length / opportunities.length : null,
      sentValue: total("sentAmount"),
      acceptedValue: total("acceptedAmount"),
      medianAcceptanceDays: median(acceptanceDelays)
    };
  }

  function countAcceptedInMonth(quotes, month) {
    return consolidateOpportunities(quotes).filter((item) => item.converted && datePart(item.acceptedAt).slice(0, 7) === month).length;
  }

  function countAwaitingInvoices(quotes) {
    return (Array.isArray(quotes) ? quotes : []).filter((item) => item?.tracking?.status === "accepted").length;
  }

  return { consolidateOpportunities, summarizeConversion, countAcceptedInMonth, countAwaitingInvoices };
});