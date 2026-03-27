export type ThemePreference = "light" | "dark";

const THEME_STORAGE_KEY = "lucide-theme";
const defaultTheme: ThemePreference = "light";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark";
}

export function getStoredThemePreference() {
  if (typeof window === "undefined") {
    return defaultTheme;
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(storedTheme) ? storedTheme : defaultTheme;
}

export function applyThemePreference(theme: ThemePreference) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  root.classList.toggle("dark", theme === "dark");
}

export function setThemePreference(theme: ThemePreference) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }

  applyThemePreference(theme);
}

export function initializeThemePreference() {
  const theme = getStoredThemePreference();
  applyThemePreference(theme);
  return theme;
}
