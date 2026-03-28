import { getSupabaseOrThrow, isSupabaseConfigured } from "@/lib/supabase";
import type { RadarAccessMode } from "@/types/supabase";

export const radarSports = ["Football", "Basketball", "Tennis"] as const;
export const RADAR_WEEKLY_LIMIT = 2;
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
    label: "Prudent",
    color: "#00E676",
    borderColor: "rgba(0, 230, 118, 0.28)",
    backgroundColor: "rgba(0, 230, 118, 0.08)",
  },
  {
    value: "balanced",
    label: "Équilibré",
    color: "#FFB020",
    borderColor: "rgba(255, 176, 32, 0.28)",
    backgroundColor: "rgba(255, 176, 32, 0.08)",
  },
  {
    value: "aggressive",
    label: "Agressif",
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
}

export interface RadarTokenRedemptionResult {
  tokenBalance: number;
  redeemedTokenCount: number;
}

export function getRiskMeta(risk: RadarRiskValue) {
  return radarRiskLevels.find((level) => level.value === risk) ?? radarRiskLevels[1];
}

export function getRiskLabel(risk: RadarRiskValue) {
  return getRiskMeta(risk).label;
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

    throw new Error(error.message);
  }

  const { data: tokenBalanceValue, error: tokenBalanceError } = await client.rpc("get_radar_token_balance", {});

  if (tokenBalanceError) {
    if (isRadarUsageSchemaError(tokenBalanceError.message)) {
      return normalizeRadarUsageStatus(count ?? 0, usedOn, 0);
    }

    throw new Error(tokenBalanceError.message);
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
      throw new Error("Connecte-toi pour utiliser Radar.");
    }

    if (isRadarUsageSchemaError(error.message)) {
      return claimLocalRadarUsage(userId, usedOn);
    }

    throw new Error(error.message);
  }

  const payload = Array.isArray(data) ? data[0] : data;

  if (!payload) {
    throw new Error("Impossible de verifier le quota Radar de la semaine.");
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

    throw new Error(error.message);
  }
}

export async function redeemRadarTokenCode(plainCode: string): Promise<RadarTokenRedemptionResult> {
  const normalizedCode = plainCode.trim().toUpperCase();

  if (!normalizedCode) {
    throw new Error("Entre le code que tu as recu.");
  }

  if (!isSupabaseConfigured) {
    throw new Error("Supabase n'est pas configure.");
  }

  const client = getSupabaseOrThrow();
  const { data, error } = await client.rpc("redeem_radar_token_code", { plain_code: normalizedCode });

  if (error) {
    const normalizedMessage = error.message.toLowerCase();

    if (normalizedMessage.includes("auth_required")) {
      throw new Error("Connecte-toi pour activer un code.");
    }

    if (normalizedMessage.includes("code_required")) {
      throw new Error("Entre le code que tu as recu.");
    }

    if (normalizedMessage.includes("code_invalid")) {
      throw new Error("Code invalide.");
    }

    if (normalizedMessage.includes("code_already_redeemed")) {
      throw new Error("Ce code a deja ete utilise.");
    }

    if (normalizedMessage.includes("code_expired")) {
      throw new Error("Ce code a expire.");
    }

    if (normalizedMessage.includes("code_email_mismatch")) {
      throw new Error("Ce code est reserve a un autre email.");
    }

    if (normalizedMessage.includes("email_required")) {
      throw new Error("Ton compte doit avoir un email valide.");
    }

    throw new Error(error.message);
  }

  const payload = Array.isArray(data) ? data[0] : data;

  if (!payload) {
    throw new Error("Impossible d'activer ce code pour le moment.");
  }

  return {
    tokenBalance: Math.max(0, Number(payload.token_balance ?? 0)),
    redeemedTokenCount: Math.max(0, Number(payload.redeemed_token_count ?? 0)),
  };
}

export async function fetchRadarSuggestions(input: RadarRequestInput): Promise<RadarResult> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase n'est pas configure.");
  }

  const client = getSupabaseOrThrow();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error("Session invalide. Reconnecte-toi.");
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 45000);
  let response: Response;

  try {
    response = await fetch("/api/radar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
      body: JSON.stringify(input),
    });
  } catch (error) {
    window.clearTimeout(timeoutId);

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Radar a pris trop de temps. Relance l'analyse.");
    }

    if (error instanceof TypeError) {
      throw new Error("Connexion impossible pour le moment. Verifie ta connexion ou relance l'analyse.");
    }

    throw error;
  }

  window.clearTimeout(timeoutId);

  const payload = (await response.json().catch(() => null)) as
    | { suggestions?: RadarSuggestion[]; window?: RadarWindowInfo; usage?: RadarUsageStatus; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Impossible d'analyser pour le moment.");
  }

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
