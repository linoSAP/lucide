import { useEffect, useState } from "react";
import { listBets } from "@/lib/bets";
import { type AppLanguage } from "@/lib/language";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/utils";
import { useAuthStore } from "@/store/use-auth-store";
import { useLanguageStore } from "@/store/use-language-store";
import type { BetRow } from "@/types/supabase";

function getUseBetsCopy(language: AppLanguage) {
  return language === "en"
    ? {
        loadFailed: "Unable to load bets.",
      }
    : {
        loadFailed: "Impossible de charger les mises.",
      };
}

export function useBets(limit?: number) {
  const session = useAuthStore((state) => state.session);
  const language = useLanguageStore((state) => state.language);
  const copy = getUseBetsCopy(language);
  const [bets, setBets] = useState<BetRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!session?.user || !isSupabaseConfigured) {
      setBets([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const data = await listBets(session.user.id, limit);
      setBets(data);
      setError(null);
    } catch (error) {
      setError(getErrorMessage(error, copy.loadFailed));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    if (!session?.user || !isSupabaseConfigured) {
      setBets([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    void listBets(session.user.id, limit)
      .then((data) => {
        if (!active) {
          return;
        }

        setBets(data);
        setError(null);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setError(getErrorMessage(error, copy.loadFailed));
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [copy.loadFailed, limit, session?.user?.id]);

  return { bets, isLoading, error, refresh };
}
