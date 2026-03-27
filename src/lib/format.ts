const moneyFormatter = new Intl.NumberFormat("fr-CM", {
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("fr-CM", {
  dateStyle: "medium",
  timeStyle: "short",
});

const shortDateFormatter = new Intl.DateTimeFormat("fr-CM", {
  day: "numeric",
  month: "short",
});

export function formatAmount(value: number) {
  return `${moneyFormatter.format(Number.isFinite(value) ? value : 0)} FCFA`;
}

export function formatAmountValue(value: number) {
  return moneyFormatter.format(Number.isFinite(value) ? value : 0);
}

export function formatOdds(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

export function formatPercent(value: number, signed = false) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const prefix = signed && safeValue > 0 ? "+" : "";
  return `${prefix}${safeValue.toFixed(1)}%`;
}

export function formatDateTime(value: string) {
  return dateFormatter.format(new Date(value));
}

export function formatShortDate(value: string) {
  return shortDateFormatter.format(new Date(value));
}
