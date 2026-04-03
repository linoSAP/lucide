import { getSupabaseOrThrow, isSupabaseConfigured } from "@/lib/supabase";
import { getStoredLanguagePreference, type AppLanguage } from "@/lib/language";
import type { RadarAccessMode } from "@/types/supabase";
import { normalizeErrorMessage } from "@/lib/utils";

export const radarSports = ["Football", "Basketball", "Tennis"] as const;
export const RADAR_WEEKLY_LIMIT = 2;
const RADAR_REQUEST_TIMEOUT_MS = 240000;
const RADAR_DISCIPLINE_TIMEOUT_MS = 90000;
const radarUsageStoragePrefix = "lucide:radar-usage";
const doualaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Douala",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const radarRiskLevels = [
  {
    value: "prudent",
    color: "#00E676",
    borderColor: "rgba(0, 230, 118, 0.28)",
    backgroundColor: "rgba(0, 230, 118, 0.08)",
  },
  {
    value: "balanced",
    color: "#FFB020",
    borderColor: "rgba(255, 176, 32, 0.28)",
    backgroundColor: "rgba(255, 176, 32, 0.08)",
  },
  {
    value: "aggressive",
    color: "#FF5252",
    borderColor: "rgba(255, 82, 82, 0.28)",
    backgroundColor: "rgba(255, 82, 82, 0.08)",
  },
] as const;

export type RadarSport = (typeof radarSports)[number];
export type RadarRiskValue = (typeof radarRiskLevels)[number]["value"];

export interface RadarLeg {
  competition: string;
  event: string;
  eventDate: string;
  market: string;
  pick: string;
}

export interface RadarSuggestion {
  label: string;
  legs: RadarLeg[];
  odds: string;
  rationale: string;
  caution: string;
}

export interface RadarWindowInfo {
  startDate: string;
  endDate: string;
  shifted: boolean;
  note: string;
}

export interface RadarResult {
  suggestions: RadarSuggestion[];
  window: RadarWindowInfo;
  usage?: RadarUsageStatus;
}

export interface RadarDisciplineAnalysis {
  summary: string;
  strengths: string[];
  warnings: string[];
  actions: string[];
}

export interface RadarUsageStatus {
  usedCount: number;
  remainingCount: number;
  limit: number;
  usedOn: string;
  tokenBalance: number;
  canUseRadar: boolean;
  nextAccessMode: RadarAccessMode;
}

export interface RadarUsageReservation extends RadarUsageStatus {
  allowed: boolean;
  usageId: string | null;
  ledgerId: string | null;
  accessMode: RadarAccessMode;
}

export interface RadarRequestInput {
  sport: RadarSport;
  risk: RadarRiskValue;
  startDate: string;
  endDate: string;
  historySummary?: string;
  language?: AppLanguage;
}

export interface RadarDisciplineRequestInput {
  statsSummary: string;
  recentResults?: string[];
  language?: AppLanguage;
}

export interface RadarTokenRedemptionResult {
  tokenBalance: number;
  redeemedTokenCount: number;
}

function getRadarLanguage() {
  return getStoredLanguagePreference();
}

function getRadarClientCopy(language: AppLanguage = getRadarLanguage()) {
  return language === "en"
    ? {
        riskLabels: {
          prudent: "Careful",
          balanced: "Balanced",
          aggressive: "Aggressive",
        },
        verifyQuota: "Unable to check Radar usage right now.",
        verifyBalance: "Unable to check your Radar balance right now.",
        signInToUse: "Sign in to use Radar.",
        verifyWeeklyQuota: "Unable to verify this week's Radar usage.",
        restoreAccess: "Unable to restore Radar access right now.",
        enterCode: "Enter the code you received.",
        supabaseMissing: "Supabase is not configured.",
        signInToActivate: "Sign in to activate a code.",
        invalidCode: "Invalid code.",
        codeUsed: "This code has already been used.",
        codeExpired: "This code has expired.",
        codeOtherEmail: "This code is reserved for another email.",
        validEmailRequired: "Your account must have a valid email.",
        activateCodeUnavailable: "Unable to activate this code right now.",
        invalidSession: "Your session is invalid. Sign in again.",
        radarTimeout: "Radar took too long. Try the analysis again.",
        radarNetwork: "Connection is unavailable right now. Check your connection and try the analysis again.",
        radarFallback: "Unable to analyze right now.",
        disciplineTimeout: "The discipline coach is taking too long. Try the analysis again.",
        disciplineFallback: "Unable to analyze your discipline right now.",
      }
    : {
        riskLabels: {
          prudent: "Prudent",
          balanced: "Équilibré",
          aggressive: "Agressif",
        },
        verifyQuota: "Impossible de verifier le quota Radar pour le moment.",
        verifyBalance: "Impossible de verifier le solde Radar pour le moment.",
        signInToUse: "Connecte-toi pour utiliser Radar.",
        verifyWeeklyQuota: "Impossible de verifier le quota Radar de la semaine.",
        restoreAccess: "Impossible de restaurer l'acces Radar pour le moment.",
        enterCode: "Entre le code que tu as recu.",
        supabaseMissing: "Supabase n'est pas configure.",
        signInToActivate: "Connecte-toi pour activer un code.",
        invalidCode: "Code invalide.",
        codeUsed: "Ce code a deja ete utilise.",
        codeExpired: "Ce code a expire.",
        codeOtherEmail: "Ce code est reserve a un autre email.",
        validEmailRequired: "Ton compte doit avoir un email valide.",
        activateCodeUnavailable: "Impossible d'activer ce code pour le moment.",
        invalidSession: "Session invalide. Reconnecte-toi.",
        radarTimeout: "Radar a pris trop de temps. Relance l'analyse.",
        radarNetwork: "Connexion impossible pour le moment. Verifie ta connexion ou relance l'analyse.",
        radarFallback: "Impossible d'analyser pour le moment.",
        disciplineTimeout: "Le coach discipline prend trop de temps. Relance l'analyse.",
        disciplineFallback: "Impossible d'analyser ta discipline pour le moment.",
      };
}

export function getRiskMeta(risk: RadarRiskValue) {
  return radarRiskLevels.find((level) => level.value === risk) ?? radarRiskLevels[1];
}

export function getRiskLabel(risk: RadarRiskValue, language: AppLanguage = getRadarLanguage()) {
  return getRadarClientCopy(language).riskLabels[risk];
}

function createRadarClientError(message: string, fallback: string) {
  return new Error(normalizeErrorMessage(message, fallback));
}

function getDoualaDateParts(date = new Date()) {
  const parts = doualaDateFormatter.formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? "0"),
    month: Number(parts.find((part) => part.type === "month")?.value ?? "0"),
    day: Number(parts.find((part) => part.type === "day")?.value ?? "0"),
  };
}

function formatUtcDateToIso(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRadarUsageWeekStart(date = new Date()) {
  const { year, month, day } = getDoualaDateParts(date);
  const weekDate = new Date(Date.UTC(year, month - 1, day));
  const weekday = weekDate.getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;

  weekDate.setUTCDate(weekDate.getUTCDate() - daysSinceMonday);
  return formatUtcDateToIso(weekDate);
}

function normalizeRadarUsageStatus(usedCount: number, usedOn: string, tokenBalance = 0): RadarUsageStatus {
  const safeUsedCount = Math.max(0, usedCount);
  const safeTokenBalance = Math.max(0, tokenBalance);
  const remainingCount = Math.max(0, RADAR_WEEKLY_LIMIT - safeUsedCount);

  return {
    usedCount: safeUsedCount,
    remainingCount,
    limit: RADAR_WEEKLY_LIMIT,
    usedOn,
    tokenBalance: safeTokenBalance,
    canUseRadar: remainingCount > 0 || safeTokenBalance > 0,
    nextAccessMode: remainingCount > 0 ? "daily" : safeTokenBalance > 0 ? "token" : "blocked",
  };
}

function isBrowser() {
  return typeof window !== "undefined";
}

function buildRadarUsageStorageKey(userId: string, usedOn: string) {
  return `${radarUsageStoragePrefix}:${userId}:${usedOn}`;
}

function readLocalRadarUsageCount(userId: string, usedOn: string) {
  if (!isBrowser()) {
    return 0;
  }

  const rawValue = window.localStorage.getItem(buildRadarUsageStorageKey(userId, usedOn));
  const parsedValue = Number.parseInt(rawValue ?? "0", 10);
  return Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : 0;
}

function writeLocalRadarUsageCount(userId: string, usedOn: string, count: number) {
  if (!isBrowser()) {
    return;
  }

  const storageKey = buildRadarUsageStorageKey(userId, usedOn);

  if (count <= 0) {
    window.localStorage.removeItem(storageKey);
    return;
  }

  window.localStorage.setItem(storageKey, String(count));
}

function createLocalRadarUsageId(userId: string, usedOn: string) {
  const uniqueSuffix = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString(36);
  return `local:${userId}:${usedOn}:${uniqueSuffix}`;
}

function claimLocalRadarUsage(userId: string, usedOn: string): RadarUsageReservation {
  const currentCount = readLocalRadarUsageCount(userId, usedOn);

  if (currentCount >= RADAR_WEEKLY_LIMIT) {
    return {
      allowed: false,
      usageId: null,
      ledgerId: null,
      accessMode: "blocked",
      ...normalizeRadarUsageStatus(currentCount, usedOn),
    };
  }

  const nextCount = currentCount + 1;
  writeLocalRadarUsageCount(userId, usedOn, nextCount);

  return {
    allowed: true,
    usageId: createLocalRadarUsageId(userId, usedOn),
    ledgerId: null,
    accessMode: "daily",
    ...normalizeRadarUsageStatus(nextCount, usedOn),
  };
}

function isRadarUsageSchemaError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("claim_radar_usage") ||
    normalized.includes("claim_radar_access") ||
    normalized.includes("refund_radar_access") ||
    normalized.includes("redeem_radar_token_code") ||
    normalized.includes("get_radar_token_balance") ||
    normalized.includes("radar_usage") ||
    normalized.includes("radar_token")
  );
}

export async function getRadarUsageStatus(userId: string): Promise<RadarUsageStatus> {
  const usedOn = getRadarUsageWeekStart();

  if (!isSupabaseConfigured) {
    return normalizeRadarUsageStatus(readLocalRadarUsageCount(userId, usedOn), usedOn, 0);
  }

  const client = getSupabaseOrThrow();
  const { count, error } = await client
    .from("radar_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("used_on", usedOn);

  if (error) {
    if (isRadarUsageSchemaError(error.message)) {
      return normalizeRadarUsageStatus(readLocalRadarUsageCount(userId, usedOn), usedOn, 0);
    }

    throw createRadarClientError(error.message, getRadarClientCopy().verifyQuota);
  }

  const { data: tokenBalanceValue, error: tokenBalanceError } = await client.rpc("get_radar_token_balance", {});

  if (tokenBalanceError) {
    if (isRadarUsageSchemaError(tokenBalanceError.message)) {
      return normalizeRadarUsageStatus(count ?? 0, usedOn, 0);
    }

    throw createRadarClientError(tokenBalanceError.message, getRadarClientCopy().verifyBalance);
  }

  return normalizeRadarUsageStatus(count ?? 0, usedOn, Number(tokenBalanceValue ?? 0));
}

export async function claimRadarUsage(userId: string): Promise<RadarUsageReservation> {
  const usedOn = getRadarUsageWeekStart();

  if (!isSupabaseConfigured) {
    return claimLocalRadarUsage(userId, usedOn);
  }

  const client = getSupabaseOrThrow();
  const { data, error } = await client.rpc("claim_radar_access", { target_day: usedOn });

  if (error) {
    if (error.message.includes("AUTH_REQUIRED")) {
      throw new Error(getRadarClientCopy().signInToUse);
    }

    if (isRadarUsageSchemaError(error.message)) {
      return claimLocalRadarUsage(userId, usedOn);
    }

    throw createRadarClientError(error.message, getRadarClientCopy().verifyWeeklyQuota);
  }

  const payload = Array.isArray(data) ? data[0] : data;

  if (!payload) {
    throw new Error(getRadarClientCopy().verifyWeeklyQuota);
  }

  return {
    allowed: Boolean(payload.allowed),
    usageId: typeof payload.usage_id === "string" ? payload.usage_id : null,
    ledgerId: typeof payload.ledger_id === "string" ? payload.ledger_id : null,
    accessMode:
      payload.access_mode === "daily" || payload.access_mode === "token" || payload.access_mode === "blocked"
        ? payload.access_mode
        : "blocked",
    ...normalizeRadarUsageStatus(Number(payload.used_count ?? 0), usedOn, Number(payload.token_balance ?? 0)),
  };
}

export async function releaseRadarUsage(usageId: string, accessMode: RadarAccessMode = "daily", ledgerId: string | null = null) {
  if (!usageId && !ledgerId) {
    return;
  }

  if (usageId && usageId.startsWith("local:")) {
    const [, userId, usedOn] = usageId.split(":", 4);

    if (!userId || !usedOn) {
      return;
    }

    const currentCount = readLocalRadarUsageCount(userId, usedOn);
    writeLocalRadarUsageCount(userId, usedOn, Math.max(0, currentCount - 1));
    return;
  }

  if (!isSupabaseConfigured) {
    return;
  }

  const client = getSupabaseOrThrow();
  const { error } = await client.rpc("refund_radar_access", {
    access_mode: accessMode,
    access_usage_id: usageId || null,
    access_ledger_id: ledgerId,
    target_day: getRadarUsageWeekStart(),
  });

  if (error) {
    if (isRadarUsageSchemaError(error.message)) {
      return;
    }

    throw createRadarClientError(error.message, getRadarClientCopy().restoreAccess);
  }
}

export async function redeemRadarTokenCode(plainCode: string): Promise<RadarTokenRedemptionResult> {
  const normalizedCode = plainCode.trim().toUpperCase();
  const copy = getRadarClientCopy();

  if (!normalizedCode) {
    throw new Error(copy.enterCode);
  }

  if (!isSupabaseConfigured) {
    throw new Error(copy.supabaseMissing);
  }

  const client = getSupabaseOrThrow();
  const { data, error } = await client.rpc("redeem_radar_token_code", { plain_code: normalizedCode });

  if (error) {
    const normalizedMessage = error.message.toLowerCase();

    if (normalizedMessage.includes("auth_required")) {
      throw new Error(copy.signInToActivate);
    }

    if (normalizedMessage.includes("code_required")) {
      throw new Error(copy.enterCode);
    }

    if (normalizedMessage.includes("code_invalid")) {
      throw new Error(copy.invalidCode);
    }

    if (normalizedMessage.includes("code_already_redeemed")) {
      throw new Error(copy.codeUsed);
    }

    if (normalizedMessage.includes("code_expired")) {
      throw new Error(copy.codeExpired);
    }

    if (normalizedMessage.includes("code_email_mismatch")) {
      throw new Error(copy.codeOtherEmail);
    }

    if (normalizedMessage.includes("email_required")) {
      throw new Error(copy.validEmailRequired);
    }

    throw createRadarClientError(error.message, copy.activateCodeUnavailable);
  }

  const payload = Array.isArray(data) ? data[0] : data;

  if (!payload) {
    throw new Error(copy.activateCodeUnavailable);
  }

  return {
    tokenBalance: Math.max(0, Number(payload.token_balance ?? 0)),
    redeemedTokenCount: Math.max(0, Number(payload.redeemed_token_count ?? 0)),
  };
}

async function getRadarAccessToken() {
  const copy = getRadarClientCopy();

  if (!isSupabaseConfigured) {
    throw new Error(copy.supabaseMissing);
  }

  const client = getSupabaseOrThrow();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();

  if (sessionError) {
    throw createRadarClientError(sessionError.message, copy.invalidSession);
  }

  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error(copy.invalidSession);
  }

  return accessToken;
}

async function postAuthorizedRadarRequest<TResponse>(options: {
  path: string;
  body: unknown;
  timeoutMs: number;
  timeoutMessage: string;
  networkMessage: string;
  fallbackMessage: string;
  language?: AppLanguage;
}): Promise<TResponse> {
  const accessToken = await getRadarAccessToken();

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), options.timeoutMs);
  let response: Response;

  try {
    response = await fetch(options.path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "x-app-language": options.language ?? getRadarLanguage(),
      },
      signal: controller.signal,
      body: JSON.stringify(options.body),
    });
  } catch (error) {
    window.clearTimeout(timeoutId);

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(options.timeoutMessage);
    }

    if (error instanceof TypeError) {
      throw new Error(options.networkMessage);
    }

    throw error;
  }

  window.clearTimeout(timeoutId);

  const payload = (await response.json().catch(() => null)) as ({ error?: string } & TResponse) | null;

  if (!response.ok) {
    throw createRadarClientError(payload?.error ?? "", options.fallbackMessage);
  }

  return (payload ?? {}) as TResponse;
}

export async function fetchRadarSuggestions(input: RadarRequestInput): Promise<RadarResult> {
  const copy = getRadarClientCopy(input.language);
  const payload = await postAuthorizedRadarRequest<{
    suggestions?: RadarSuggestion[];
    window?: RadarWindowInfo;
    usage?: RadarUsageStatus;
  }>({
    path: "/api/radar",
    body: input,
    timeoutMs: RADAR_REQUEST_TIMEOUT_MS,
    timeoutMessage: copy.radarTimeout,
    networkMessage: copy.radarNetwork,
    fallbackMessage: copy.radarFallback,
    language: input.language,
  });

  return {
    suggestions: payload?.suggestions ?? [],
    window: payload?.window ?? {
      startDate: input.startDate,
      endDate: input.endDate,
      shifted: false,
      note: "",
    },
    usage: payload?.usage,
  };
}

export async function fetchRadarDisciplineAnalysis(
  input: RadarDisciplineRequestInput,
): Promise<RadarDisciplineAnalysis> {
  const copy = getRadarClientCopy(input.language);
  const payload = await postAuthorizedRadarRequest<{
    analysis?: RadarDisciplineAnalysis;
  }>({
    path: "/api/radar-discipline",
    body: input,
    timeoutMs: RADAR_DISCIPLINE_TIMEOUT_MS,
    timeoutMessage: copy.disciplineTimeout,
    networkMessage: copy.radarNetwork,
    fallbackMessage: copy.disciplineFallback,
    language: input.language,
  });

  if (!payload.analysis) {
    throw new Error(copy.disciplineFallback);
  }

  return payload.analysis;
}
