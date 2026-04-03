import { getStoredCurrencyPreference } from "@/lib/currency";
import { getStoredLanguagePreference, type AppLanguage } from "@/lib/language";

const localeByLanguage: Record<AppLanguage, string> = {
  fr: "fr-CM",
  en: "en-CM",
};

const moneyFormatters: Record<AppLanguage, Intl.NumberFormat> = {
  fr: new Intl.NumberFormat(localeByLanguage.fr, {
    maximumFractionDigits: 0,
  }),
  en: new Intl.NumberFormat(localeByLanguage.en, {
    maximumFractionDigits: 0,
  }),
};

const dateFormatters: Record<AppLanguage, Intl.DateTimeFormat> = {
  fr: new Intl.DateTimeFormat(localeByLanguage.fr, {
    dateStyle: "medium",
    timeStyle: "short",
  }),
  en: new Intl.DateTimeFormat(localeByLanguage.en, {
    dateStyle: "medium",
    timeStyle: "short",
  }),
};

const shortDateFormatters: Record<AppLanguage, Intl.DateTimeFormat> = {
  fr: new Intl.DateTimeFormat(localeByLanguage.fr, {
    day: "numeric",
    month: "short",
  }),
  en: new Intl.DateTimeFormat(localeByLanguage.en, {
    day: "numeric",
    month: "short",
  }),
};

function getActiveLanguage() {
  return getStoredLanguagePreference();
}

export function getActiveCurrencyCode() {
  return getStoredCurrencyPreference();
}

export function formatAmount(value: number) {
  return `${moneyFormatters[getActiveLanguage()].format(Number.isFinite(value) ? value : 0)} ${getActiveCurrencyCode()}`;
}

export function formatAmountValue(value: number) {
  return moneyFormatters[getActiveLanguage()].format(Number.isFinite(value) ? value : 0);
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
  return dateFormatters[getActiveLanguage()].format(new Date(value));
}

export function formatShortDate(value: string) {
  return shortDateFormatters[getActiveLanguage()].format(new Date(value));
}
