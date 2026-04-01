import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Check, Copy, HeartHandshake, KeyRound, LogOut, MessageCircle, Moon, PencilLine, SunMedium } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import {
  RADAR_TOKEN_UNIT_PRICE_FCFA,
  buildRadarPaymentHref,
  buildWhatsAppHref,
  developerWhatsapp,
  getRadarCreditOffer,
  radarCreditOffers,
  radarPaymentMethodLabels,
  radarPaymentRecipients,
  type RadarCreditOfferId,
} from "@/lib/radar-credit";
import { generateRadarTokenCode, loginRadarAdmin, logoutRadarAdmin, type RadarAdminCodePayload } from "@/lib/radar-admin";
import { getStoredThemePreference, setThemePreference, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/use-auth-store";
import type { RadarPaymentMethod } from "@/types/supabase";

const supportAmounts = [
  { label: "500 FCFA", value: "500" },
  { label: "1000 FCFA", value: "1000" },
  { label: "2000 FCFA", value: "2000" },
  { label: "Libre", value: "libre" },
] as const;

const themeOptions: Array<{
  value: ThemePreference;
  label: string;
  description: string;
  icon: typeof SunMedium;
}> = [
  {
    value: "light",
    label: "Clair",
    description: "Plus net, plus lumineux.",
    icon: SunMedium,
  },
  {
    value: "dark",
    label: "Sombre",
    description: "Plus discret, plus dense.",
    icon: Moon,
  },
];

function getInitials(value: string) {
  const cleaned = value.trim();

  if (!cleaned) {
    return "LU";
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function getAvatarPalette(seed: string) {
  const palettes = [
    ["rgba(0, 230, 118, 0.24)", "#00E676"],
    ["rgba(255, 176, 32, 0.24)", "#FFB020"],
    ["rgba(87, 181, 255, 0.24)", "#57B5FF"],
    ["rgba(255, 82, 82, 0.22)", "#FF5252"],
  ] as const;

  const hash = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palettes[hash % palettes.length];
}

function sanitizeSupportAmount(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function resolveSupportAmount(selectedAmount: (typeof supportAmounts)[number]["value"], customAmount: string) {
  return selectedAmount === "libre" ? sanitizeSupportAmount(customAmount) : selectedAmount;
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function ProfilePage() {
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const signOut = useAuthStore((state) => state.signOut);

  const [username, setUsername] = useState(profile?.username ?? "");
  const [selectedAmount, setSelectedAmount] = useState<(typeof supportAmounts)[number]["value"]>("500");
  const [customAmount, setCustomAmount] = useState("");
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => getStoredThemePreference());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [waveCopyState, setWaveCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [isAdminPromptOpen, setIsAdminPromptOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);
  const [isAuthenticatingAdmin, setIsAuthenticatingAdmin] = useState(false);
  const [isAdminGeneratorOpen, setIsAdminGeneratorOpen] = useState(false);
  const [adminOfferId, setAdminOfferId] = useState<RadarCreditOfferId | "custom">("pulse");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPaymentMethod, setAdminPaymentMethod] = useState<RadarPaymentMethod>("orange_money");
  const [adminCustomTokenCount, setAdminCustomTokenCount] = useState("1");
  const [adminCustomAmountFcfa, setAdminCustomAmountFcfa] = useState(String(RADAR_TOKEN_UNIT_PRICE_FCFA));
  const [adminGenerateError, setAdminGenerateError] = useState<string | null>(null);
  const [adminGenerateMessage, setAdminGenerateMessage] = useState<string | null>(null);
  const [isGeneratingAdminCode, setIsGeneratingAdminCode] = useState(false);
  const [isClosingAdminGenerator, setIsClosingAdminGenerator] = useState(false);
  const [generatedAdminCode, setGeneratedAdminCode] = useState<RadarAdminCodePayload | null>(null);
  const [adminCopyState, setAdminCopyState] = useState<"idle" | "copied" | "error">("idle");
  const lightThemeHoldTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setUsername(profile?.username ?? "");
  }, [profile?.username]);

  useEffect(() => {
    return () => {
      if (lightThemeHoldTimeoutRef.current) {
        window.clearTimeout(lightThemeHoldTimeoutRef.current);
      }
    };
  }, []);

  const displayName = username.trim() || profile?.username || session?.user.email?.split("@")[0] || "Lucide";
  const initials = getInitials(displayName);
  const [avatarBackground, avatarText] = useMemo(() => getAvatarPalette(displayName), [displayName]);
  const adminSelectedOffer = useMemo(() => {
    return adminOfferId === "custom" ? null : getRadarCreditOffer(adminOfferId);
  }, [adminOfferId]);
  const supportAmount = resolveSupportAmount(selectedAmount, customAmount);
  const supportAmountValue = Number.parseInt(supportAmount || "0", 10) || 0;
  const supportAmountLabel = supportAmountValue > 0 ? `${supportAmountValue} FCFA` : "Choisis un montant";
  const orangeMoneyHref = buildRadarPaymentHref("orange_money", supportAmountValue);
  const mobileMoneyHref = buildRadarPaymentHref("mobile_money", supportAmountValue);
  const developerWhatsappHref = buildWhatsAppHref(developerWhatsapp, "Bonjour, j'ai une question sur Lucide.");
  const adminTokenCount = adminSelectedOffer
    ? adminSelectedOffer.tokenCount
    : Math.max(1, Number.parseInt(adminCustomTokenCount || "0", 10) || 0);
  const adminAmountFcfa = adminSelectedOffer
    ? adminSelectedOffer.amountFcfa
    : Math.max(1, Number.parseInt(adminCustomAmountFcfa || "0", 10) || 0);
  const adminOfferLabel = adminSelectedOffer
    ? `${adminSelectedOffer.label} (${adminSelectedOffer.tokenCount} jetons)`
    : "Pack personnalise";

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    const result = await updateProfile({
      username: username.trim() || null,
      wave_number: profile?.wave_number ?? null,
    });

    if (result.error) {
      setError(result.error);
      setIsSaving(false);
      return;
    }

    setMessage("Profil mis a jour.");
    setIsSaving(false);
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    await signOut();
    setIsSigningOut(false);
  }

  async function handleCopyWaveNumber() {
    try {
      await copyText(radarPaymentRecipients.wave);
      setWaveCopyState("copied");
      window.setTimeout(() => setWaveCopyState("idle"), 2200);
    } catch {
      setWaveCopyState("error");
      window.setTimeout(() => setWaveCopyState("idle"), 2200);
    }
  }

  function handleThemePreferenceChange(nextTheme: ThemePreference) {
    setThemePreferenceState(nextTheme);
    setThemePreference(nextTheme);
  }

  function clearAdminHoldTimer() {
    if (lightThemeHoldTimeoutRef.current) {
      window.clearTimeout(lightThemeHoldTimeoutRef.current);
      lightThemeHoldTimeoutRef.current = null;
    }
  }

  function handleLightThemePressStart() {
    clearAdminHoldTimer();
    lightThemeHoldTimeoutRef.current = window.setTimeout(() => {
      setIsAdminPromptOpen(true);
      setAdminPassword("");
      setAdminError(null);
      lightThemeHoldTimeoutRef.current = null;
    }, 5000);
  }

  async function handleAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAuthenticatingAdmin(true);
    setAdminError(null);

    try {
      await loginRadarAdmin(adminPassword);
      setIsAdminPromptOpen(false);
      setAdminPassword("");
      setAdminEmail(session?.user.email ?? "");
      setAdminOfferId("pulse");
      setAdminPaymentMethod("orange_money");
      setAdminCustomTokenCount("1");
      setAdminCustomAmountFcfa(String(RADAR_TOKEN_UNIT_PRICE_FCFA));
      setAdminGenerateError(null);
      setAdminGenerateMessage(null);
      setGeneratedAdminCode(null);
      setAdminCopyState("idle");
      setIsAdminGeneratorOpen(true);
    } catch (nextError) {
      setAdminError(nextError instanceof Error ? nextError.message : "Acces admin impossible.");
    } finally {
      setIsAuthenticatingAdmin(false);
    }
  }

  async function handleGenerateAdminCode() {
    setIsGeneratingAdminCode(true);
    setAdminGenerateError(null);
    setAdminGenerateMessage(null);

    try {
      const payload = await generateRadarTokenCode({
        email: adminEmail.trim(),
        amountFcfa: adminAmountFcfa,
        tokenCount: adminTokenCount,
        paymentMethod: adminPaymentMethod,
        offerLabel: adminOfferLabel,
      });

      setGeneratedAdminCode(payload);
      setAdminGenerateMessage("Code genere. Tu peux maintenant l'envoyer manuellement au client via WhatsApp.");
      setAdminCopyState("idle");
    } catch (nextError) {
      setGeneratedAdminCode(null);
      setAdminGenerateError(nextError instanceof Error ? nextError.message : "Generation impossible.");
    } finally {
      setIsGeneratingAdminCode(false);
    }
  }

  async function handleCopyAdminCode() {
    if (!generatedAdminCode?.code) {
      return;
    }

    try {
      await copyText(generatedAdminCode.code);
      setAdminCopyState("copied");
      window.setTimeout(() => setAdminCopyState("idle"), 2200);
    } catch {
      setAdminCopyState("error");
      window.setTimeout(() => setAdminCopyState("idle"), 2200);
    }
  }

  async function handleCloseAdminGenerator() {
    setIsClosingAdminGenerator(true);

    try {
      await logoutRadarAdmin();
    } catch {
      // Ignore logout cleanup errors and still close the panel.
    } finally {
      setGeneratedAdminCode(null);
      setAdminGenerateError(null);
      setAdminGenerateMessage(null);
      setAdminCopyState("idle");
      setIsAdminGeneratorOpen(false);
      setIsClosingAdminGenerator(false);
    }
  }

  return (
    <>
      <PageShell className="space-y-3">
        <form className="surface hairline rounded-[24px] px-4 py-4 shadow-soft" onSubmit={handleSave}>
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-semibold"
              style={{ backgroundColor: avatarBackground, color: avatarText }}
            >
              {initials}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-base font-semibold text-foreground">{displayName}</p>
                <PencilLine className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">{session?.user.email ?? "Aucun email"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {profile?.created_at ? `Membre depuis ${formatDateTime(profile.created_at)}` : "Profil en cours de creation"}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input placeholder="Pseudo" value={username} onChange={(event) => setUsername(event.target.value)} />
            <Input value={session?.user.email ?? ""} readOnly className="bg-secondary/72 text-muted-foreground" />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="min-h-[1.25rem]">
              {message ? <p className="text-sm text-positive">{message}</p> : null}
              {error ? <p className="text-sm text-negative/90">{error}</p> : null}
            </div>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? "Sauvegarde..." : "Enregistrer"}
            </Button>
          </div>
        </form>

        <div className="surface hairline rounded-[24px] px-4 py-4 shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-foreground">Apparence</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Choisis le theme le plus confortable.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = option.value === themePreference;
              const isLightTheme = option.value === "light";

              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "rounded-[22px] border px-4 py-4 text-left transition",
                    isActive
                      ? "border-primary/24 bg-primary/10 ring-1 ring-primary/18"
                      : "border-border/8 bg-card/70 hover:bg-card/86",
                  )}
                  onClick={() => handleThemePreferenceChange(option.value)}
                  onPointerDown={isLightTheme ? handleLightThemePressStart : undefined}
                  onPointerUp={isLightTheme ? clearAdminHoldTimer : undefined}
                  onPointerLeave={isLightTheme ? clearAdminHoldTimer : undefined}
                  onPointerCancel={isLightTheme ? clearAdminHoldTimer : undefined}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-2xl",
                        isActive ? "bg-primary/16 text-primary" : "bg-secondary/92 text-muted-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    {isActive ? <span className="text-xs font-medium text-primary">Actif</span> : null}
                  </div>

                  <p className="mt-4 text-sm font-semibold text-foreground">{option.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[26px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,176,32,0.08))] px-4 py-4 shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-foreground">Soutenir Lucide</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Tes dons soutiennent le projet, l'hebergement et les futures ameliorations de Radar.
              </p>
            </div>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-primary">
              <HeartHandshake className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {supportAmounts.map((amount) => (
              <button
                key={amount.value}
                type="button"
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm transition",
                  selectedAmount === amount.value
                    ? "bg-white/12 text-foreground ring-1 ring-white/12"
                    : "bg-white/6 text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setSelectedAmount(amount.value)}
              >
                {amount.label}
              </button>
            ))}
          </div>

          {selectedAmount === "libre" ? (
            <Input
              className="mt-3"
              inputMode="numeric"
              placeholder="Montant en FCFA"
              value={customAmount}
              onChange={(event) => setCustomAmount(sanitizeSupportAmount(event.target.value))}
            />
          ) : null}

          <div className="mt-4 rounded-[18px] border border-white/6 bg-white/4 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Montant choisi</p>
            <p className="mt-1 text-base font-semibold text-foreground">{supportAmountLabel}</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-[#ff8a1e]/24 bg-[linear-gradient(180deg,rgba(255,138,30,0.14),rgba(255,138,30,0.06))] px-4 py-4">
              <p className="text-sm font-semibold text-foreground">Orange Money</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Pour soutenir Lucide avec Orange Money.</p>
              <div className="mt-3 inline-flex rounded-full bg-black/10 px-3 py-1 text-xs font-medium text-foreground/88">
                {supportAmountLabel}
              </div>

              {orangeMoneyHref ? (
                <a
                  href={orangeMoneyHref}
                  className={cn(buttonVariants({ size: "default" }), "mt-4 flex w-full justify-center rounded-[16px] bg-[#ff7900] text-white hover:bg-[#ff8a1f]")}
                >
                  Donner
                </a>
              ) : (
                <Button className="mt-4 w-full rounded-[16px]" disabled>
                  Choisir un montant
                </Button>
              )}
            </div>

            <div className="rounded-[22px] border border-[#ffd248]/24 bg-[linear-gradient(180deg,rgba(255,210,72,0.16),rgba(255,210,72,0.06))] px-4 py-4">
              <p className="text-sm font-semibold text-foreground">Mobile Money</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Pour soutenir Lucide avec Mobile Money.</p>
              <div className="mt-3 inline-flex rounded-full bg-black/10 px-3 py-1 text-xs font-medium text-foreground/88">
                {supportAmountLabel}
              </div>

              {mobileMoneyHref ? (
                <a
                  href={mobileMoneyHref}
                  className={cn(buttonVariants({ size: "default" }), "mt-4 flex w-full justify-center rounded-[16px] bg-[#ffd248] text-[#332400] hover:bg-[#ffdc6f]")}
                >
                  Donner
                </a>
              ) : (
                <Button className="mt-4 w-full rounded-[16px]" disabled>
                  Choisir un montant
                </Button>
              )}
            </div>
          </div>

          <div className="mt-3 rounded-[22px] border border-[#5cc8ff]/24 bg-[linear-gradient(180deg,rgba(92,200,255,0.14),rgba(92,200,255,0.05))] px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Wave</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Si tu soutiens via Wave, copie simplement ce numero.</p>
              </div>

              <div className="inline-flex rounded-full bg-black/10 px-3 py-1 text-xs font-medium text-foreground/88">
                {supportAmountLabel}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="rounded-[16px] border border-white/8 bg-black/10 px-4 py-3 text-base font-semibold tracking-[0.12em] text-foreground">
                {radarPaymentRecipients.wave}
              </div>

              <Button type="button" variant="secondary" className="rounded-[16px]" onClick={handleCopyWaveNumber}>
                {waveCopyState === "copied" ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Numero copie
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copier le numero
                  </>
                )}
              </Button>
            </div>

            {waveCopyState === "error" ? <p className="mt-3 text-xs text-negative/90">Copie impossible pour le moment.</p> : null}
          </div>

          <p className="mt-3 text-xs leading-5 text-muted-foreground">Choisis ton montant puis touche le service que tu utilises.</p>
        </div>

        <div className="flex items-center justify-between gap-3 px-1 pt-1">
          <p className="text-xs text-muted-foreground">Lucide v1.0</p>

          <button
            type="button"
            className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            <LogOut className="h-4 w-4" />
            {isSigningOut ? "Sortie..." : "Deconnexion"}
          </button>
        </div>

        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 mx-auto flex w-full max-w-md justify-end px-4">
          <a
            href={developerWhatsappHref}
            target="_blank"
            rel="noreferrer"
            className={cn(
              buttonVariants(),
              "pointer-events-auto rounded-full border-0 bg-[#25D366] px-4 text-[#062014] shadow-soft hover:bg-[#1fb85a]",
            )}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Contacter le developpeur
          </a>
        </div>
      </PageShell>

      {isAdminPromptOpen ? (
        <>
          <button
            type="button"
            aria-label="Fermer l'acces admin"
            className="fixed inset-0 z-40 bg-background/56 backdrop-blur-md"
            onClick={() => {
              setIsAdminPromptOpen(false);
              setAdminPassword("");
              setAdminError(null);
            }}
          />

          <div className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md px-3 pb-4">
            <div className="surface hairline rounded-[28px] px-4 pb-5 pt-3 shadow-soft">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-white/10" />

              <div className="mt-4">
                <p className="text-base font-semibold text-foreground">Acces admin Radar</p>
                <p className="mt-1 text-sm text-muted-foreground">Mot de passe requis pour ouvrir l'espace de generation.</p>
              </div>

              <form className="mt-5 space-y-3" onSubmit={handleAdminLogin}>
                <Input
                  type="password"
                  placeholder="Mot de passe admin"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                />

                {adminError ? <p className="px-1 text-sm text-negative/90">{adminError}</p> : null}

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      setIsAdminPromptOpen(false);
                      setAdminPassword("");
                      setAdminError(null);
                    }}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isAuthenticatingAdmin}>
                    {isAuthenticatingAdmin ? "Ouverture..." : "Ouvrir"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </>
      ) : null}

      {isAdminGeneratorOpen ? (
        <>
          <button
            type="button"
            aria-label="Fermer le generateur admin"
            className="fixed inset-0 z-40 bg-background/64 backdrop-blur-md"
            onClick={() => {
              void handleCloseAdminGenerator();
            }}
          />

          <div className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md px-3 pb-4">
            <div className="surface hairline max-h-[88vh] overflow-y-auto rounded-[28px] px-4 pb-5 pt-3 shadow-soft">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-white/10" />

              <div className="mt-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-foreground">Generateur admin Radar</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Espace cache pour preparer un code a usage unique a renvoyer manuellement au client.
                  </p>
                </div>

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-warning/12 text-warning">
                  <KeyRound className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <Input
                  type="email"
                  placeholder="Email utilisateur"
                  value={adminEmail}
                  onChange={(event) => setAdminEmail(event.target.value)}
                />

                <Select value={adminOfferId} onChange={(event) => setAdminOfferId(event.target.value as RadarCreditOfferId | "custom")}>
                  {radarCreditOffers.map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.label} - {offer.tokenCount} jetons - {offer.amountFcfa} FCFA
                    </option>
                  ))}
                  <option value="custom">Pack personnalise</option>
                </Select>

                {adminOfferId === "custom" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      inputMode="numeric"
                      placeholder="Jetons"
                      value={adminCustomTokenCount}
                      onChange={(event) => setAdminCustomTokenCount(event.target.value.replace(/\D/g, "").slice(0, 3))}
                    />
                    <Input
                      inputMode="numeric"
                      placeholder="Montant FCFA"
                      value={adminCustomAmountFcfa}
                      onChange={(event) => setAdminCustomAmountFcfa(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                  </div>
                ) : null}

                <Select value={adminPaymentMethod} onChange={(event) => setAdminPaymentMethod(event.target.value as RadarPaymentMethod)}>
                  {Object.entries(radarPaymentMethodLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="mt-4 rounded-[20px] border border-white/8 bg-white/4 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{adminOfferLabel}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {adminTokenCount} jetons - {adminAmountFcfa} FCFA - {radarPaymentMethodLabels[adminPaymentMethod]}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground/90">
                      Base actuelle: {RADAR_TOKEN_UNIT_PRICE_FCFA} FCFA par jeton.
                    </p>
                  </div>

                  <div className="rounded-full bg-black/10 px-3 py-1 text-xs font-medium text-foreground/88">Usage unique</div>
                </div>
              </div>

              <div className="mt-4 min-h-[1.25rem]">
                {adminGenerateMessage ? <p className="text-sm text-positive">{adminGenerateMessage}</p> : null}
                {adminGenerateError ? <p className="text-sm text-negative/90">{adminGenerateError}</p> : null}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button variant="ghost" type="button" onClick={() => void handleCloseAdminGenerator()} disabled={isClosingAdminGenerator}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {isClosingAdminGenerator ? "Fermeture..." : "Fermer l'acces"}
                </Button>
                <Button type="button" onClick={handleGenerateAdminCode} disabled={isGeneratingAdminCode}>
                  {isGeneratingAdminCode ? "Generation..." : "Generer le code"}
                </Button>
              </div>

              {generatedAdminCode ? (
                <div className="mt-4 rounded-[24px] border border-primary/18 bg-primary/8 px-4 py-4 shadow-soft">
                  <p className="text-sm font-semibold text-foreground">Code pret a envoyer</p>

                  <div className="mt-3 rounded-[18px] border border-white/8 bg-black/10 px-4 py-4 text-center text-base font-semibold tracking-[0.16em] text-foreground">
                    {generatedAdminCode.code}
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                    <p>{generatedAdminCode.email}</p>
                    <p>
                      {generatedAdminCode.tokenCount} jetons - {generatedAdminCode.amountFcfa} FCFA -{" "}
                      {radarPaymentMethodLabels[generatedAdminCode.paymentMethod]}
                    </p>
                    <p>Expire le {formatDateTime(generatedAdminCode.expiresAt)}</p>
                  </div>

                  <Button variant="secondary" className="mt-4 w-full rounded-[16px]" onClick={handleCopyAdminCode}>
                    {adminCopyState === "copied" ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Code copie
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copier le code
                      </>
                    )}
                  </Button>

                  {adminCopyState === "error" ? (
                    <p className="mt-3 text-xs text-negative/90">Copie impossible pour le moment.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
