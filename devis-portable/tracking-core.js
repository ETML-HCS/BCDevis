(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BCDevisTracking = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const CONVERTED_STATUSES = new Set(["accepted", "invoiced"]);
  const LOSS_REASONS = [
    { key: "price", label: "Prix" },
    { key: "timing", label: "Calendrier ou disponibilité" },
    { key: "thinking", label: "Souhaite réfléchir" },
    { key: "no-answer", label: "Ne répond plus" },
    { key: "competitor", label: "Autre solution choisie" },
    { key: "abandoned", label: "Projet abandonné" },
    { key: "duplicate", label: "Doublon ou devis remplacé" },
    { key: "other", label: "Autre" }
  ];
  const LOSS_REASON_KEYS = new Set(LOSS_REASONS.map((reason) => reason.key));
  const PERIODS = ["month", "previous-month", "quarter", "year", "all"];

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

  function lossReasonKey(value) {
    return LOSS_REASON_KEYS.has(value) ? value : "";
  }

  function lossReasonLabel(value) {
    return LOSS_REASONS.find((reason) => reason.key === value)?.label || "";
  }

  // Seules les relances confirmées comme effectuées comptent ; une date prévue n'est pas une relance.
  function followUpCount(item) {
    const events = Array.isArray(item?.tracking?.events) ? item.tracking.events : [];
    return events.filter((event) => event?.type === "contact").length;
  }

  function sentChannel(item) {
    const events = Array.isArray(item?.tracking?.events) ? item.tracking.events : [];
    return String(events.find((event) => event?.type === "status" && event.status === "sent" && event.channel)?.channel || "");
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
      const lost = !converted && ["refused", "expired"].includes(latestStatus);
      const pending = Boolean(sentAt) && !converted && !lost;

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
        pending,
        followUps: versions.reduce((total, item) => total + followUpCount(item), 0),
        channel: versions.map(sentChannel).find(Boolean) || "",
        lossReason: lost ? lossReasonKey(latest?.tracking?.lossReason) : "",
        sentAmount: safeAmount(amountOf, sentVersion || latest),
        acceptedAmount: converted ? safeAmount(amountOf, acceptedVersion || latest) : 0,
        pendingAmount: pending ? safeAmount(amountOf, latest) : 0
      };
    });
  }

  function inPeriod(opportunity, startDate, endDate) {
    const sentDate = datePart(opportunity.sentAt);
    return Boolean(sentDate) && (!startDate || sentDate >= startDate) && (!endDate || sentDate <= endDate);
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

  function summarizeOpportunities(opportunities) {
    const converted = opportunities.filter((item) => item.converted);
    const lost = opportunities.filter((item) => !item.converted && ["refused", "expired"].includes(item.latestStatus));
    const total = (field) => opportunities.reduce((sum, item) => sum + Number(item[field] || 0), 0);
    const acceptanceDelays = converted.map((item) => daysBetween(item.sentAt, item.acceptedAt));
    const reasonCounts = new Map();
    lost.forEach((item) => {
      const key = item.lossReason || "unspecified";
      reasonCounts.set(key, (reasonCounts.get(key) || 0) + 1);
    });

    return {
      sent: opportunities.length,
      converted: converted.length,
      refused: lost.filter((item) => item.latestStatus === "refused").length,
      expired: lost.filter((item) => item.latestStatus === "expired").length,
      pending: opportunities.filter((item) => item.pending).length,
      conversionRate: opportunities.length ? converted.length / opportunities.length : null,
      sentValue: total("sentAmount"),
      acceptedValue: total("acceptedAmount"),
      pendingValue: total("pendingAmount"),
      medianAcceptanceDays: median(acceptanceDelays),
      acceptedAfterFollowUp: converted.filter((item) => item.followUps > 0).length,
      expiredWithoutFollowUp: lost.filter((item) => item.latestStatus === "expired" && item.followUps === 0).length,
      lossReasons: [...reasonCounts.entries()]
        .map(([key, count]) => ({ key, label: lossReasonLabel(key) || "Non renseigné", count }))
        .sort((left, right) => right.count - left.count || (left.key === "unspecified") - (right.key === "unspecified"))
    };
  }

  function summarizeConversion(quotes, { startDate = "", endDate = "", amountOf = () => 0 } = {}) {
    return summarizeOpportunities(consolidateOpportunities(quotes, { amountOf }).filter((item) => inPeriod(item, startDate, endDate)));
  }

  function shiftMonth(month, offset) {
    const [year, monthNumber] = month.split("-").map(Number);
    const index = year * 12 + monthNumber - 1 + offset;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
  }

  function lastDayOfMonth(month) {
    const [year, monthNumber] = month.split("-").map(Number);
    return `${month}-${String(new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()).padStart(2, "0")}`;
  }

  // Les cohortes sont toujours des mois calendaires complets, sauf le mois en cours qui s'arrête à aujourd'hui.
  function periodRange(period, today) {
    const month = String(today || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) return { startDate: "", endDate: "" };
    if (period === "previous-month") {
      const previous = shiftMonth(month, -1);
      return { startDate: `${previous}-01`, endDate: lastDayOfMonth(previous) };
    }
    if (period === "quarter") return { startDate: `${shiftMonth(month, -2)}-01`, endDate: today };
    if (period === "year") return { startDate: `${shiftMonth(month, -11)}-01`, endDate: today };
    if (period === "all") return { startDate: "", endDate: today };
    return { startDate: `${month}-01`, endDate: today };
  }

  function monthlyConversion(quotes, { endDate = "", months = 6, amountOf = () => 0 } = {}) {
    const lastMonth = String(endDate || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(lastMonth)) return [];
    const opportunities = consolidateOpportunities(quotes, { amountOf });
    const count = Math.max(1, Math.min(24, Number(months) || 6));
    return Array.from({ length: count }, (_, index) => {
      const month = shiftMonth(lastMonth, index - count + 1);
      const summary = summarizeOpportunities(opportunities.filter((item) => inPeriod(item, `${month}-01`, lastDayOfMonth(month))));
      return { month, sent: summary.sent, converted: summary.converted, pending: summary.pending, conversionRate: summary.conversionRate, sentValue: summary.sentValue, acceptedValue: summary.acceptedValue };
    });
  }

  function csvCell(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value.toFixed(2) : "";
    // Une cellule commençant par =, +, - ou @ serait interprétée comme une formule par un tableur.
    const text = String(value ?? "").replace(/^([=+\-@\t\r])/, "'$1");
    return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function exportConversionCSV(quotes, { startDate = "", endDate = "", amountOf = () => 0, statusLabel = (status) => status } = {}) {
    const header = ["Devis", "Version", "Client", "Téléphone", "E-mail", "Statut", "Envoyé le", "Accepté le", "Refusé le", "Facturé le", "Canal", "Relances", "Motif de perte", "Montant envoyé CHF", "Montant accepté CHF"];
    const rows = consolidateOpportunities(quotes, { amountOf })
      .filter((item) => inPeriod(item, startDate, endDate))
      .sort((left, right) => String(left.sentAt).localeCompare(String(right.sentAt)))
      .map((item) => [
        item.latest?.number || "",
        `V${Number(item.latest?.revisionNumber) || 1}`,
        item.latest?.client?.name || "",
        item.latest?.client?.phone || "",
        item.latest?.client?.email || "",
        statusLabel(item.latestStatus),
        datePart(item.sentAt),
        datePart(item.acceptedAt),
        datePart(item.refusedAt),
        datePart(item.invoicedAt),
        item.channel,
        String(item.followUps),
        lossReasonLabel(item.lossReason),
        item.sentAmount,
        item.acceptedAmount
      ]);
    return `﻿${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  }

  function countAcceptedInMonth(quotes, month) {
    return consolidateOpportunities(quotes).filter((item) => item.converted && datePart(item.acceptedAt).slice(0, 7) === month).length;
  }

  function countAwaitingInvoices(quotes) {
    return (Array.isArray(quotes) ? quotes : []).filter((item) => item?.tracking?.status === "accepted").length;
  }

  return {
    LOSS_REASONS,
    PERIODS,
    consolidateOpportunities,
    summarizeConversion,
    monthlyConversion,
    periodRange,
    exportConversionCSV,
    followUpCount,
    lossReasonKey,
    lossReasonLabel,
    countAcceptedInMonth,
    countAwaitingInvoices
  };
});