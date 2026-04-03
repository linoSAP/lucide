import { create } from "zustand";
import {
  getStoredLanguagePreference,
  isAppLanguage,
  setLanguagePreference,
  type AppLanguage,
} from "@/lib/language";

interface LanguageStore {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  syncLanguageFromProfile: (language: string | null | undefined) => void;
}

export const useLanguageStore = create<LanguageStore>((set, get) => ({
  language: getStoredLanguagePreference(),
  setLanguage: (language) => {
    setLanguagePreference(language);
    set({ language });
  },
  syncLanguageFromProfile: (language) => {
    if (!isAppLanguage(language) || get().language === language) {
      return;
    }

    setLanguagePreference(language);
    set({ language });
  },
}));
