import { getSupabaseOrThrow } from "@/lib/supabase";
import type { BetKind, BetRow, BetStatus } from "@/types/supabase";

export interface CumulativeBalancePoint {
  createdAt: string;
  label: string;
  balance: number;
}

export interface CreateBetValues {
  sport: string;
  matchLabel: string;
  betKind: BetKind;
  eventCount?: number | null;
  minOdds?: number | null;
  maxOdds?: number | null;
  stake: number;
  odds: number;
  status: BetStatus;
  cashoutAmount?: number | null;
}

export interface UpdatePendingBetValues extends CreateBetValues {}

export interface BetKindSummary {
  kind: BetKind;
  count: number;
  settledCount: number;
  totalStake: number;
  totalPayout: number;
  net: number;
  winRate: number;
  averageEventCount: number;
}

export function isBetPending(status: BetStatus) {
  return status === "pending";
}

export function isBetSettled(status: BetStatus) {
  return status !== "pending";
}

export function isComboBet(kind: BetKind) {
  return kind === "combo";
}

export function getBetKindLabel(kind: BetKind) {
  return isComboBet(kind) ? "Combine" : "Simple";
}

export function getBetKindVariant(kind: BetKind) {
  return isComboBet(kind) ? ("warning" as const) : ("muted" as const);
}

const allowedBetKinds = new Set<BetKind>(["single", "combo"]);
const allowedBetStatuses = new Set<BetStatus>(["pending", "won", "lost", "cashed_out"]);

function normalizeTextField(value: string, label: string, maxLength: number) {
  const normalizedValue = value.replace(/\s+/g, " ").trim();

  if (!normalizedValue) {
    throw new Error(`${label} manquant.`);
  }

  return normalizedValue.slice(0, maxLength);
}

function sanitizePositiveNumber(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} invalide.`);
  }

  return Number(value.toFixed(2));
}

function sanitizeOptionalPositiveNumber(value?: number | null) {
  if (!Number.isFinite(value ?? NaN)) {
    return null;
  }

  return sanitizePositiveNumber(value ?? 0, "Cote");
}

function sanitizeBetValues(values: CreateBetValues) {
  if (!allowedBetKinds.has(values.betKind)) {
    throw new Error("Type de pari invalide.");
  }

  if (!allowedBetStatuses.has(values.status)) {
    throw new Error("Statut de pari invalide.");
  }

  const sport = normalizeTextField(values.sport, "Sport", 40);
  const matchLabel = normalizeTextField(values.matchLabel, "Match", 140);
  const stake = sanitizePositiveNumber(values.stake, "Mise");
  const odds = sanitizePositiveNumber(values.odds, "Cote");
  const minOdds = sanitizeOptionalPositiveNumber(values.minOdds);
  const maxOdds = sanitizeOptionalPositiveNumber(values.maxOdds);
  const isCombo = isComboBet(values.betKind);
  const rawEventCount = Number.isFinite(values.eventCount ?? NaN) ? Math.round(values.eventCount ?? 2) : 2;
  const eventCount = isCombo ? Math.max(2, rawEventCount) : 1;
  const cashoutAmount = values.status === "cashed_out" ? sanitizePositiveNumber(values.cashoutAmount ?? NaN, "Cashout") : null;

  if (minOdds !== null && maxOdds !== null && maxOdds < minOdds) {
    throw new Error("La cote max doit etre superieure ou egale a la cote min.");
  }

  return {
    sport,
    matchLabel,
    betKind: values.betKind,
    eventCount,
    minOdds: isCombo ? minOdds : null,
    maxOdds: isCombo ? maxOdds : null,
    stake,
    odds,
    status: values.status,
    cashoutAmount,
  };
}

function sanitizeOptionalOdd(value?: number | null) {
  return Number.isFinite(value ?? NaN) ? Number((value ?? 0).toFixed(2)) : null;
}

function getBetStructureValues(values: Pick<CreateBetValues, "betKind" | "eventCount" | "minOdds" | "maxOdds">) {
  const isCombo = isComboBet(values.betKind);

  return {
    bet_kind: values.betKind,
    event_count: isCombo ? Math.max(2, Math.round(values.eventCount ?? 2)) : 1,
    min_odds: isCombo ? sanitizeOptionalOdd(values.minOdds) : null,
    max_odds: isCombo ? sanitizeOptionalOdd(values.maxOdds) : null,
  };
}

export function computePayout(stake: number, odds: number) {
  return Number((stake * odds).toFixed(2));
}

export function getPayoutForStatus(stake: number, odds: number, status: BetStatus, cashoutAmount?: number | null) {
  if (status === "won") {
    return computePayout(stake, odds);
  }

  if (status === "cashed_out") {
    return Number((Number.isFinite(cashoutAmount ?? NaN) ? cashoutAmount ?? 0 : 0).toFixed(2));
  }

  return 0;
}

export async function listBets(userId: string, limit?: number) {
  const client = getSupabaseOrThrow();

  let query = client
    .from("bets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function createBet(userId: string, values: CreateBetValues) {
  const client = getSupabaseOrThrow();
  const sanitizedValues = sanitizeBetValues(values);

  const payout = getPayoutForStatus(
    sanitizedValues.stake,
    sanitizedValues.odds,
    sanitizedValues.status,
    sanitizedValues.cashoutAmount,
  );
  const structure = getBetStructureValues(sanitizedValues);

  const { data, error } = await client
    .from("bets")
    .insert({
      user_id: userId,
      sport: sanitizedValues.sport,
      match_label: sanitizedValues.matchLabel,
      bet_kind: structure.bet_kind,
      event_count: structure.event_count,
      min_odds: structure.min_odds,
      max_odds: structure.max_odds,
      stake: sanitizedValues.stake,
      odds: sanitizedValues.odds,
      status: sanitizedValues.status,
      payout,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updatePendingBet(userId: string, betId: string, values: UpdatePendingBetValues) {
  const client = getSupabaseOrThrow();
  const sanitizedValues = sanitizeBetValues(values);
  const payout = getPayoutForStatus(
    sanitizedValues.stake,
    sanitizedValues.odds,
    sanitizedValues.status,
    sanitizedValues.cashoutAmount,
  );
  const structure = getBetStructureValues(sanitizedValues);

  const { data, error } = await client
    .from("bets")
    .update({
      sport: sanitizedValues.sport,
      match_label: sanitizedValues.matchLabel,
      bet_kind: structure.bet_kind,
      event_count: structure.event_count,
      min_odds: structure.min_odds,
      max_odds: structure.max_odds,
      stake: sanitizedValues.stake,
      odds: sanitizedValues.odds,
      status: sanitizedValues.status,
      payout,
    })
    .eq("id", betId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Seuls les paris en cours peuvent etre modifies.");
  }

  return data;
}

export function getStatusLabel(status: BetStatus) {
  if (status === "won") {
    return "Gagne";
  }

  if (status === "cashed_out") {
    return "Cashout";
  }

  if (status === "lost") {
    return "Perdu";
  }

  return "En cours";
}

export function getStatusVariant(status: BetStatus) {
  if (status === "won") {
    return "positive" as const;
  }

  if (status === "cashed_out") {
    return "warning" as const;
  }

  if (status === "lost") {
    return "negative" as const;
  }

  return "muted" as const;
}

export function calculateBetMetrics(bets: BetRow[]) {
  const totalStake = bets.reduce((sum, bet) => sum + bet.stake, 0);
  const totalPayout = bets.reduce((sum, bet) => sum + bet.payout, 0);
  const settledBets = bets.filter((bet) => isBetSettled(bet.status));
  const settledStake = settledBets.reduce((sum, bet) => sum + bet.stake, 0);
  const winCount = settledBets.filter((bet) => bet.status === "won").length;
  const pendingCount = bets.filter((bet) => isBetPending(bet.status)).length;
  const openExposure = bets
    .filter((bet) => isBetPending(bet.status))
    .reduce((sum, bet) => sum + bet.stake, 0);
  const averageOdds = bets.length
    ? bets.reduce((sum, bet) => sum + bet.odds, 0) / bets.length
    : 0;
  const net = settledBets.reduce((sum, bet) => sum + getBetNetDelta(bet), 0);
  const roi = settledStake > 0 ? (net / settledStake) * 100 : 0;
  const winRate = settledBets.length > 0 ? (winCount / settledBets.length) * 100 : 0;

  const sportCount = bets.reduce<Record<string, number>>((accumulator, bet) => {
    accumulator[bet.sport] = (accumulator[bet.sport] ?? 0) + 1;
    return accumulator;
  }, {});

  const favoriteSport = Object.entries(sportCount).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "Aucun";

  return {
    totalStake,
    totalPayout,
    settledStake,
    pendingCount,
    openExposure,
    averageOdds,
    winCount,
    winRate,
    net,
    roi,
    favoriteSport,
  };
}

export function getBetNetDelta(bet: BetRow) {
  if (bet.status === "pending") {
    return 0;
  }

  if (bet.status === "won" || bet.status === "cashed_out") {
    return bet.payout - bet.stake;
  }

  return -bet.stake;
}

export function getBetReturnLabel(status: BetStatus) {
  if (status === "pending") {
    return "Potentiel";
  }

  if (status === "cashed_out") {
    return "Cashout";
  }

  return "Retour";
}

export function getBetReturnAmount(bet: BetRow) {
  if (bet.status === "pending") {
    return computePayout(bet.stake, bet.odds);
  }

  return bet.payout;
}

export function getBetStructureSummary(bet: BetRow) {
  if (!isComboBet(bet.bet_kind)) {
    return "1 evenement";
  }

  const parts = [`${bet.event_count} ev.`];

  if (bet.min_odds && bet.max_odds) {
    parts.push(`${bet.min_odds.toFixed(2)} a ${bet.max_odds.toFixed(2)}`);
  } else if (bet.min_odds) {
    parts.push(`min ${bet.min_odds.toFixed(2)}`);
  } else if (bet.max_odds) {
    parts.push(`max ${bet.max_odds.toFixed(2)}`);
  }

  return parts.join(" - ");
}

export function calculateAverageStake(bets: BetRow[]) {
  if (!bets.length) {
    return 0;
  }

  return bets.reduce((sum, bet) => sum + bet.stake, 0) / bets.length;
}

export function getMostProfitableSport(bets: BetRow[]) {
  const settledBets = bets.filter((bet) => isBetSettled(bet.status));

  if (!settledBets.length) {
    return "Aucun";
  }

  const profitBySport = settledBets.reduce<Record<string, number>>((accumulator, bet) => {
    accumulator[bet.sport] = (accumulator[bet.sport] ?? 0) + getBetNetDelta(bet);
    return accumulator;
  }, {});

  return Object.entries(profitBySport).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "Aucun";
}

export function getWorstLosingStreak(bets: BetRow[]) {
  const settledBets = [...bets]
    .filter((bet) => isBetSettled(bet.status))
    .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());

  let currentStreak = 0;
  let worstStreak = 0;

  for (const bet of settledBets) {
    if (bet.status === "lost") {
      currentStreak += 1;
      worstStreak = Math.max(worstStreak, currentStreak);
      continue;
    }

    currentStreak = 0;
  }

  return worstStreak;
}

function calculateBetKindSummary(bets: BetRow[], kind: BetKind): BetKindSummary {
  const relevantBets = bets.filter((bet) => bet.bet_kind === kind);
  const settledBets = relevantBets.filter((bet) => isBetSettled(bet.status));
  const winCount = settledBets.filter((bet) => bet.status === "won").length;

  return {
    kind,
    count: relevantBets.length,
    settledCount: settledBets.length,
    totalStake: relevantBets.reduce((sum, bet) => sum + bet.stake, 0),
    totalPayout: relevantBets.reduce((sum, bet) => sum + bet.payout, 0),
    net: settledBets.reduce((sum, bet) => sum + getBetNetDelta(bet), 0),
    winRate: settledBets.length > 0 ? (winCount / settledBets.length) * 100 : 0,
    averageEventCount:
      relevantBets.length > 0
        ? relevantBets.reduce((sum, bet) => sum + (bet.event_count || 1), 0) / relevantBets.length
        : kind === "combo"
          ? 0
          : 1,
  };
}

export function calculateBetKindBreakdown(bets: BetRow[]) {
  return {
    single: calculateBetKindSummary(bets, "single"),
    combo: calculateBetKindSummary(bets, "combo"),
  };
}

export function getCumulativeBalanceSeries(bets: BetRow[], toLabel: (value: string) => string): CumulativeBalancePoint[] {
  const chronologicalBets = [...bets].sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
  );

  let runningBalance = 0;

  return chronologicalBets.map((bet) => {
    runningBalance += getBetNetDelta(bet);

    return {
      createdAt: bet.created_at,
      label: toLabel(bet.created_at),
      balance: Number(runningBalance.toFixed(2)),
    };
  });
}
