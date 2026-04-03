import type { AppLanguage } from "@/lib/language";

const CURRENCY_STORAGE_KEY = "lucide-currency";

export const appCurrencies = [
  { code: "XAF", flag: "🇨🇲", nameFr: "Franc CFA BEAC", nameEn: "Central African CFA franc" },
  { code: "XOF", flag: "🇸🇳", nameFr: "Franc CFA BCEAO", nameEn: "West African CFA franc" },
  { code: "USD", flag: "🇺🇸", nameFr: "Dollar americain", nameEn: "US dollar" },
  { code: "EUR", flag: "🇪🇺", nameFr: "Euro", nameEn: "Euro" },
  { code: "AOA", flag: "🇦🇴", nameFr: "Kwanza angolais", nameEn: "Angolan kwanza" },
  { code: "BIF", flag: "🇧🇮", nameFr: "Franc burundais", nameEn: "Burundian franc" },
  { code: "BWP", flag: "🇧🇼", nameFr: "Pula botswana", nameEn: "Botswana pula" },
  { code: "CDF", flag: "🇨🇩", nameFr: "Franc congolais", nameEn: "Congolese franc" },
  { code: "CVE", flag: "🇨🇻", nameFr: "Escudo cap-verdien", nameEn: "Cape Verde escudo" },
  { code: "DJF", flag: "🇩🇯", nameFr: "Franc djiboutien", nameEn: "Djiboutian franc" },
  { code: "DZD", flag: "🇩🇿", nameFr: "Dinar algerien", nameEn: "Algerian dinar" },
  { code: "EGP", flag: "🇪🇬", nameFr: "Livre egyptienne", nameEn: "Egyptian pound" },
  { code: "ERN", flag: "🇪🇷", nameFr: "Nakfa eritreen", nameEn: "Eritrean nakfa" },
  { code: "ETB", flag: "🇪🇹", nameFr: "Birr ethiopien", nameEn: "Ethiopian birr" },
  { code: "GHS", flag: "🇬🇭", nameFr: "Cedi ghaneen", nameEn: "Ghanaian cedi" },
  { code: "GMD", flag: "🇬🇲", nameFr: "Dalasi gambien", nameEn: "Gambian dalasi" },
  { code: "GNF", flag: "🇬🇳", nameFr: "Franc guineen", nameEn: "Guinean franc" },
  { code: "KES", flag: "🇰🇪", nameFr: "Shilling kenyan", nameEn: "Kenyan shilling" },
  { code: "KMF", flag: "🇰🇲", nameFr: "Franc comorien", nameEn: "Comorian franc" },
  { code: "LRD", flag: "🇱🇷", nameFr: "Dollar liberien", nameEn: "Liberian dollar" },
  { code: "LSL", flag: "🇱🇸", nameFr: "Loti lesothan", nameEn: "Lesotho loti" },
  { code: "LYD", flag: "🇱🇾", nameFr: "Dinar libyen", nameEn: "Libyan dinar" },
  { code: "MAD", flag: "🇲🇦", nameFr: "Dirham marocain", nameEn: "Moroccan dirham" },
  { code: "MGA", flag: "🇲🇬", nameFr: "Ariary malgache", nameEn: "Malagasy ariary" },
  { code: "MRU", flag: "🇲🇷", nameFr: "Ouguiya mauritanien", nameEn: "Mauritanian ouguiya" },
  { code: "MUR", flag: "🇲🇺", nameFr: "Roupie mauricienne", nameEn: "Mauritian rupee" },
  { code: "MWK", flag: "🇲🇼", nameFr: "Kwacha malawite", nameEn: "Malawian kwacha" },
  { code: "MZN", flag: "🇲🇿", nameFr: "Metical mozambicain", nameEn: "Mozambican metical" },
  { code: "NAD", flag: "🇳🇦", nameFr: "Dollar namibien", nameEn: "Namibian dollar" },
  { code: "NGN", flag: "🇳🇬", nameFr: "Naira nigerian", nameEn: "Nigerian naira" },
  { code: "RWF", flag: "🇷🇼", nameFr: "Franc rwandais", nameEn: "Rwandan franc" },
  { code: "SCR", flag: "🇸🇨", nameFr: "Roupie seychelloise", nameEn: "Seychellois rupee" },
  { code: "SDG", flag: "🇸🇩", nameFr: "Livre soudanaise", nameEn: "Sudanese pound" },
  { code: "SLE", flag: "🇸🇱", nameFr: "Leone sierra-leonais", nameEn: "Sierra Leonean leone" },
  { code: "SOS", flag: "🇸🇴", nameFr: "Shilling somalien", nameEn: "Somali shilling" },
  { code: "SSP", flag: "🇸🇸", nameFr: "Livre sud-soudanaise", nameEn: "South Sudanese pound" },
  { code: "STN", flag: "🇸🇹", nameFr: "Dobra sao-tomeen", nameEn: "Sao Tome and Principe dobra" },
  { code: "SZL", flag: "🇸🇿", nameFr: "Lilangeni swazi", nameEn: "Swazi lilangeni" },
  { code: "TND", flag: "🇹🇳", nameFr: "Dinar tunisien", nameEn: "Tunisian dinar" },
  { code: "TZS", flag: "🇹🇿", nameFr: "Shilling tanzanien", nameEn: "Tanzanian shilling" },
  { code: "UGX", flag: "🇺🇬", nameFr: "Shilling ougandais", nameEn: "Ugandan shilling" },
  { code: "ZAR", flag: "🇿🇦", nameFr: "Rand sud-africain", nameEn: "South African rand" },
  { code: "ZMW", flag: "🇿🇲", nameFr: "Kwacha zambien", nameEn: "Zambian kwacha" },
  { code: "ZWG", flag: "🇿🇼", nameFr: "Zimbabwe Gold", nameEn: "Zimbabwe Gold" },
] as const;

export type AppCurrency = (typeof appCurrencies)[number]["code"];

const fallbackCurrency: AppCurrency = "XAF";

const currencySet = new Set<AppCurrency>(appCurrencies.map((currency) => currency.code));
const currencyMap = new Map<AppCurrency, (typeof appCurrencies)[number]>(
  appCurrencies.map((currency) => [currency.code, currency]),
);

export function isAppCurrency(value: unknown): value is AppCurrency {
  return typeof value === "string" && currencySet.has(value as AppCurrency);
}

export function getCurrencyMeta(currency: string | null | undefined) {
  return currencyMap.get(isAppCurrency(currency) ? currency : fallbackCurrency) ?? currencyMap.get(fallbackCurrency)!;
}

export function getCurrencyDisplayName(currency: string | null | undefined, language: AppLanguage) {
  const meta = getCurrencyMeta(currency);
  return language === "fr" ? meta.nameFr : meta.nameEn;
}

export function getCurrencyOptionLabel(currency: string | null | undefined, language: AppLanguage) {
  const meta = getCurrencyMeta(currency);
  return `${meta.flag} ${meta.code} - ${getCurrencyDisplayName(meta.code, language)}`;
}

export function getStoredCurrencyPreference() {
  if (typeof window === "undefined") {
    return fallbackCurrency;
  }

  const storedValue = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
  return isAppCurrency(storedValue) ? storedValue : fallbackCurrency;
}

export function setCurrencyPreference(currency: AppCurrency) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
  }
}
