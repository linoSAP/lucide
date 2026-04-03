import { create } from "zustand";
import {
  getStoredCurrencyPreference,
  isAppCurrency,
  setCurrencyPreference,
  type AppCurrency,
} from "@/lib/currency";

interface CurrencyStore {
  currency: AppCurrency;
  setCurrency: (currency: AppCurrency) => void;
  syncCurrencyFromProfile: (currency: string | null | undefined) => void;
}

export const useCurrencyStore = create<CurrencyStore>((set, get) => ({
  currency: getStoredCurrencyPreference(),
  setCurrency: (currency) => {
    setCurrencyPreference(currency);
    set({ currency });
  },
  syncCurrencyFromProfile: (currency) => {
    if (!isAppCurrency(currency) || get().currency === currency) {
      return;
    }

    setCurrencyPreference(currency);
    set({ currency });
  },
}));
