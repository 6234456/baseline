export function formatMoney(value: number, currency = "EUR") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

export function formatCompactMoney(value: number, currency = "EUR") {
  const absolute = Math.abs(value);
  const scaled = absolute >= 1_000_000 ? value / 1_000_000 : value / 1_000;
  const suffix = absolute >= 1_000_000 ? "M" : "k";
  return `${currency} ${scaled.toFixed(absolute >= 1_000_000 ? 1 : 0)}${suffix}`;
}

export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}
