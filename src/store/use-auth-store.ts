import type { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";
import { getStoredLanguagePreference } from "@/lib/language";
import { getSupabaseOrThrow, isSupabaseConfigured, supabase } from "@/lib/supabase";
import { normalizeErrorMessage } from "@/lib/utils";
import type { ProfileInsert, ProfileRow, ProfileUpdate } from "@/types/supabase";

type AuthStatus = "loading" | "ready";

interface AuthMutationResult {
  error: string | null;
}

interface SignUpResult extends AuthMutationResult {
  requiresEmailConfirmation: boolean;
}

interface AuthStore {
  initialized: boolean;
  status: AuthStatus;
  session: Session | null;
  profile: ProfileRow | null;
  error: string | null;
  initialize: () => Promise<void>;
  refreshProfile: (userId?: string | null) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<AuthMutationResult>;
  signUpWithPassword: (email: string, password: string) => Promise<SignUpResult>;
  updateProfile: (values: Pick<ProfileUpdate, "username" | "wave_number" | "language" | "currency">) => Promise<AuthMutationResult>;
  signOut: () => Promise<AuthMutationResult>;
}

let isSubscribedToAuth = false;

function getAuthErrorMessage(message: string) {
  const normalized = message.trim().toLowerCase();
  const isEnglish = getStoredLanguagePreference() === "en";

  if (normalized.includes("invalid login credentials")) {
    return isEnglish ? "Incorrect email or password." : "Email ou mot de passe incorrect.";
  }

  if (normalized.includes("email not confirmed")) {
    return isEnglish ? "Confirm your email before signing in." : "Confirme ton email avant de te connecter.";
  }

  if (normalized.includes("user already registered")) {
    return isEnglish ? "An account already exists with this email." : "Un compte existe deja avec cet email.";
  }

  if (normalized.includes("email rate limit exceeded")) {
    return isEnglish
      ? "Too many emails were sent for now. Try again later or disable email confirmation in Supabase."
      : "Trop d'emails envoyes pour le moment. Reessaie plus tard ou desactive la confirmation email dans Supabase.";
  }

  if (normalized.includes("password should be at least")) {
    return isEnglish ? "The password must be at least 6 characters long." : "Le mot de passe doit contenir au moins 6 caracteres.";
  }

  if (normalized.includes("signup is disabled")) {
    return isEnglish ? "Email sign-up is disabled on this Supabase project." : "L'inscription par email est desactivee sur ce projet Supabase.";
  }

  return normalizeErrorMessage(
    message,
    isEnglish ? "Connection is unavailable right now. Please try again." : "Connexion impossible pour le moment. Reessaie.",
  );
}

function isMissingProfileColumnError(message: string, columnName: string) {
  const normalized = message.toLowerCase();
  return normalized.includes(columnName) && (normalized.includes("column") || normalized.includes("schema cache"));
}

function getGenericCopy() {
  const isEnglish = getStoredLanguagePreference() === "en";

  return {
    profileLoadError: isEnglish ? "Unable to load the profile." : "Impossible de charger le profil.",
    supabaseMissing: isEnglish
      ? "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
      : "Supabase n'est pas configure. Ajoute VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.",
    noActiveSession: isEnglish ? "No active session." : "Aucune session active.",
  };
}

async function fetchOrCreateProfile(user: User) {
  const client = getSupabaseOrThrow();

  const { data: existingProfile, error: selectError } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existingProfile) {
    return existingProfile;
  }

  const fallbackUsername = user.email?.split("@")[0] ?? null;

  const { data: insertedProfile, error: insertError } = await client
    .from("profiles")
    .insert({
      id: user.id,
      username: fallbackUsername,
    })
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  return insertedProfile;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  initialized: false,
  status: "loading",
  session: null,
  profile: null,
  error: null,
  initialize: async () => {
    if (!isSupabaseConfigured) {
      set({ initialized: true, status: "ready", error: null });
      return;
    }

    if (!isSubscribedToAuth && supabase) {
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, status: "ready", error: null });
        void get().refreshProfile(session?.user?.id ?? null);
      });
      isSubscribedToAuth = true;
    }

    const { data, error } = await getSupabaseOrThrow().auth.getSession();

    if (error) {
      set({
        initialized: true,
        status: "ready",
        error: normalizeErrorMessage(error.message, getGenericCopy().profileLoadError),
      });
      return;
    }

    set({ initialized: true, status: "ready", session: data.session, error: null });
    await get().refreshProfile(data.session?.user?.id ?? null);
  },
  refreshProfile: async (userId) => {
    const currentUser = get().session?.user;

    if (!userId || !supabase || !currentUser) {
      set({ profile: null });
      return;
    }

    try {
      const profile = await fetchOrCreateProfile(currentUser);
      set({ profile, error: null });
    } catch (error) {
      const genericCopy = getGenericCopy();
      set({
        profile: null,
        error: error instanceof Error ? normalizeErrorMessage(error.message, genericCopy.profileLoadError) : genericCopy.profileLoadError,
      });
    }
  },
  signInWithPassword: async (email, password) => {
    if (!supabase) {
      const genericCopy = getGenericCopy();
      return {
        error: genericCopy.supabaseMissing,
      };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error ? getAuthErrorMessage(error.message) : null };
  },
  signUpWithPassword: async (email, password) => {
    if (!supabase) {
      const genericCopy = getGenericCopy();
      return {
        error: genericCopy.supabaseMissing,
        requiresEmailConfirmation: false,
      };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      return {
        error: getAuthErrorMessage(error.message),
        requiresEmailConfirmation: false,
      };
    }

    return {
      error: null,
      requiresEmailConfirmation: data.session === null,
    };
  },
  updateProfile: async (values) => {
    const userId = get().session?.user.id;

    if (!userId || !supabase) {
      return { error: getGenericCopy().noActiveSession };
    }

    let { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          username: values.username,
          wave_number: values.wave_number,
          language: values.language,
          currency: values.currency,
        },
        { onConflict: "id" },
      )
      .select()
      .single();

    const missingLanguageColumn = Boolean(error && values.language && isMissingProfileColumnError(error.message, "language"));
    const missingCurrencyColumn = Boolean(error && values.currency && isMissingProfileColumnError(error.message, "currency"));

    if (error && (missingLanguageColumn || missingCurrencyColumn)) {
      const retryPayload: ProfileInsert = {
        id: userId,
        username: values.username,
        wave_number: values.wave_number,
      };

      if (values.language && !missingLanguageColumn) {
        retryPayload.language = values.language;
      }

      if (values.currency && !missingCurrencyColumn) {
        retryPayload.currency = values.currency;
      }

      const retryResult = await supabase
        .from("profiles")
        .upsert(retryPayload, { onConflict: "id" })
        .select()
        .single();

      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      return { error: normalizeErrorMessage(error.message, getGenericCopy().profileLoadError) };
    }

    set({ profile: data, error: null });
    return { error: null };
  },
  signOut: async () => {
    if (!supabase) {
      set({ session: null, profile: null });
      return { error: null };
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      return { error: normalizeErrorMessage(error.message, getGenericCopy().noActiveSession) };
    }

    set({ session: null, profile: null, error: null });
    return { error: null };
  },
}));
