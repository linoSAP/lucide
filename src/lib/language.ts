export type AppLanguage = "fr" | "en";

const LANGUAGE_STORAGE_KEY = "lucide-language";

const fallbackLanguage: AppLanguage = "fr";

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === "fr" || value === "en";
}

export function applyLanguagePreference(language: AppLanguage) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.lang = language;
}

export function getStoredLanguagePreference() {
  if (typeof window === "undefined") {
    return fallbackLanguage;
  }

  const storedValue = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isAppLanguage(storedValue) ? storedValue : fallbackLanguage;
}

export function setLanguagePreference(language: AppLanguage) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }

  applyLanguagePreference(language);
}

export function initializeLanguagePreference() {
  const language = getStoredLanguagePreference();
  applyLanguagePreference(language);
  return language;
}
