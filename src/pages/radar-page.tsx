import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BookmarkPlus, LoaderCircle, Sparkles, X } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { RadarCreditsModal } from "@/components/radar/radar-credits-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  calculateAverageStake,
  calculateBetKindBreakdown,
  calculateBetMetrics,
  createBet,
  getBetKindLabel,
  getMostProfitableSport,
  getWorstLosingStreak,
} from "@/lib/bets";
import { formatAmount, formatPercent } from "@/lib/format";
import { getStoredLanguagePreference, type AppLanguage } from "@/lib/language";
import { useBets } from "@/hooks/use-bets";
import {
  RADAR_WEEKLY_LIMIT,
  fetchRadarDisciplineAnalysis,
  fetchRadarSuggestions,
  type RadarDisciplineAnalysis,
  getRadarUsageStatus,
  getRiskLabel,
  getRiskMeta,
  radarRiskLevels,
  radarSports,
  type RadarRiskValue,
  type RadarSport,
  type RadarSuggestion,
  type RadarUsageStatus,
} from "@/lib/radar";
import { cn, getErrorMessage } from "@/lib/utils";
import { useAuthStore } from "@/store/use-auth-store";
import { useLanguageStore } from "@/store/use-language-store";
import type { BetRow } from "@/types/supabase";

type RadarDateMode = "day" | "range";

function getRadarPageCopy(language: AppLanguage) {
  return language === "en"
    ? {
        dateModes: { day: "Day", range: "Range" },
        noHistoryUseful: "No useful history yet.",
        tickets: "bets",
        hitRateShort: "WR",
        bestSportShort: "best sport",
        singlesShort: "singles",
        combosShort: "combos",
        won: "won",
        lost: "lost",
        noHistoryDiscipline: "No usable history yet.",
        totalVolume: "Total volume",
        settledBets: "Settled bets",
        openBets: "Open bets",
        hitRate: "Hit rate",
        roi: "ROI",
        netResult: "Net result",
        averageStake: "Average stake",
        openExposure: "Open exposure",
        averageOdds: "Average odds",
        mostPlayedSport: "Most played sport",
        mostProfitableSport: "Most profitable sport",
        worstLosingStreak: "Worst losing streak",
        averageEvents: "average",
        events: "event(s)",
        reading: "Reading",
        caution: "Caution",
        bookmakerOddsEditable: "Bookmaker odds can be edited before saving.",
        save: "Save",
        signIn: "Sign in.",
        analysisUnavailable: "Analysis is unavailable right now.",
        addedToJournal: "Added to Journal.",
        saveComboUnavailable: "Unable to save this selection right now.",
        needThreeTickets: "Add at least 3 bets to get a useful discipline read.",
        disciplineUnavailable: "Unable to analyze your discipline right now.",
        suggestions: "Suggestions",
        suggestionsSubtitle: "By date, without noise.",
        analyzeLoading: "Analyzing...",
        quotaLoading: "Quota...",
        limitReached: "Limit reached",
        analyze: "Analyze",
        risk: "Risk",
        dates: "Dates",
        thisWeek: "This week",
        tokens: "Tokens",
        buyTokens: "Buy tokens",
        nextUsesToken: "This week's free quota is empty. The next analysis will use 1 token.",
        weeklyQuota: `${RADAR_WEEKLY_LIMIT} / week.`,
        quotaReachedTitle: "This week's free quota has been reached.",
        quotaReachedDescription: "Get a token pack to keep using Radar without waiting for next week.",
        viewJournal: "View Journal",
        discipline: "Discipline",
        disciplineSubtitle: "Read your habits before starting again.",
        disciplineHint: "Reads your journal to surface bankroll habits, pace, and discipline patterns.",
        settledShort: "Settled",
        balance: "Balance",
        analyzingHistory: "Analysis in progress...",
        analyzeHistory: "Analyze my history",
        reliableTipsHint: "Add at least 3 bets in Journal to unlock reliable guidance.",
        strengths: "Strengths",
        warnings: "Warnings",
        weekActions: "This Week's Actions",
        shiftedWindowFound: "Nothing on your date. Tested window:",
        nothingOnDate: "Nothing on this date.",
        verifyDatesOdds: "Check dates and odds.",
        noSuggestion: "No suggestion on this selection.",
        addToJournalTitle: "Add to Journal",
        enterOddsStake: "Enter odds and stake.",
        estimated: "Estimated",
        bookmakerOdds: "Bookmaker odds",
        stake: "Stake",
        saving: "Saving...",
        addToJournal: "Add to Journal",
        close: "Close",
      }
    : {
        dateModes: { day: "Jour", range: "Plage" },
        noHistoryUseful: "Aucun historique utile.",
        tickets: "tickets",
        hitRateShort: "WR",
        bestSportShort: "sport fort",
        singlesShort: "simples",
        combosShort: "combines",
        won: "gagne",
        lost: "perdu",
        noHistoryDiscipline: "Aucun historique exploitable pour le moment.",
        totalVolume: "Volume total",
        settledBets: "Tickets regles",
        openBets: "Paris en cours",
        hitRate: "Reussite",
        roi: "ROI",
        netResult: "Bilan net",
        averageStake: "Mise moyenne",
        openExposure: "Exposition ouverte",
        averageOdds: "Cote moyenne",
        mostPlayedSport: "Sport le plus joue",
        mostProfitableSport: "Sport le plus rentable",
        worstLosingStreak: "Pire serie perdante",
        averageEvents: "moyenne",
        events: "evenement(s)",
        reading: "Lecture",
        caution: "Vigilance",
        bookmakerOddsEditable: "Cote bookmaker editable avant ajout.",
        save: "Enregistrer",
        signIn: "Connecte-toi.",
        analysisUnavailable: "Analyse indisponible pour le moment.",
        addedToJournal: "Ajoute au Journal.",
        saveComboUnavailable: "Impossible d'enregistrer cette selection pour le moment.",
        needThreeTickets: "Ajoute au moins 3 tickets pour obtenir une lecture utile de ta discipline.",
        disciplineUnavailable: "Impossible d'analyser ta discipline pour le moment.",
        suggestions: "Suggestions",
        suggestionsSubtitle: "Par date, sans bruit.",
        analyzeLoading: "Analyse...",
        quotaLoading: "Quota...",
        limitReached: "Limite atteinte",
        analyze: "Analyser",
        risk: "Risque",
        dates: "Dates",
        thisWeek: "Cette semaine",
        tokens: "Jetons",
        buyTokens: "Acheter des jetons",
        nextUsesToken: "Le quota gratuit de la semaine est vide. La prochaine analyse utilisera 1 jeton.",
        weeklyQuota: `${RADAR_WEEKLY_LIMIT} / semaine.`,
        quotaReachedTitle: "Le quota gratuit de la semaine est atteint.",
        quotaReachedDescription: "Prends un pack de jetons pour continuer a utiliser Radar sans attendre la semaine suivante.",
        viewJournal: "Voir le Journal",
        discipline: "Discipline",
        disciplineSubtitle: "Lire ses habitudes avant de relancer.",
        disciplineHint: "Lecture de ton journal pour faire ressortir tes habitudes de bankroll, de rythme et de discipline.",
        settledShort: "Regles",
        balance: "Bilan",
        analyzingHistory: "Analyse en cours...",
        analyzeHistory: "Analyser mon historique",
        reliableTipsHint: "Ajoute au moins 3 tickets dans le Journal pour obtenir des conseils assez fiables.",
        strengths: "Forces",
        warnings: "Points de Vigilance",
        weekActions: "Actions de la Semaine",
        shiftedWindowFound: "Rien sur ta date. Fenetre testee:",
        nothingOnDate: "Rien sur cette date.",
        verifyDatesOdds: "Dates et cotes a verifier.",
        noSuggestion: "Aucune suggestion sur cette selection.",
        addToJournalTitle: "Ajouter au Journal",
        enterOddsStake: "Entre la cote et la mise.",
        estimated: "Estimee",
        bookmakerOdds: "Cote bookmaker",
        stake: "Mise",
        saving: "Enregistrement...",
        addToJournal: "Ajouter au Journal",
        close: "Fermer",
      };
}

const buyTokensButtonClass =
  "rounded-full border border-[#ffd248]/45 bg-[linear-gradient(135deg,#fff1a8_0%,#ffd248_36%,#ffb020_100%)] text-[#3b2400] shadow-[0_16px_42px_rgba(255,176,32,0.24)] hover:brightness-[1.03] hover:shadow-[0_20px_48px_rgba(255,176,32,0.3)]";

const radarDateLabelFormatters: Record<AppLanguage, Intl.DateTimeFormat> = {
  fr: new Intl.DateTimeFormat("fr-CM", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }),
  en: new Intl.DateTimeFormat("en-CM", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }),
};

const radarEventDateLabelFormatters: Record<AppLanguage, Intl.DateTimeFormat> = {
  fr: new Intl.DateTimeFormat("fr-CM", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }),
  en: new Intl.DateTimeFormat("en-CM", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }),
};

function getActiveLanguage() {
  return getStoredLanguagePreference();
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getRelativeDateInputValue(offset = 0) {
  const nextDate = new Date();
  nextDate.setHours(12, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() + offset);
  return toDateInputValue(nextDate);
}

function normalizeRadarWindow(dateMode: RadarDateMode, selectedDate: string, rangeStart: string, rangeEnd: string) {
  if (dateMode === "day") {
    const fallbackDate = selectedDate || getRelativeDateInputValue(0);
    return { startDate: fallbackDate, endDate: fallbackDate };
  }

  const fallbackStart = rangeStart || getRelativeDateInputValue(0);
  const fallbackEnd = rangeEnd || fallbackStart;

  return fallbackStart <= fallbackEnd
    ? { startDate: fallbackStart, endDate: fallbackEnd }
    : { startDate: fallbackEnd, endDate: fallbackStart };
}

function formatRadarWindowLabel(startDate: string, endDate: string) {
  const formatter = radarDateLabelFormatters[getActiveLanguage()];
  const startLabel = formatter.format(new Date(`${startDate}T12:00:00`));
  const endLabel = formatter.format(new Date(`${endDate}T12:00:00`));

  return startDate === endDate ? startLabel : `${startLabel} - ${endLabel}`;
}

function formatRadarEventDateLabel(eventDate: string) {
  return radarEventDateLabelFormatters[getActiveLanguage()].format(new Date(`${eventDate}T12:00:00`));
}

function parseDecimal(value: string) {
  return Number.parseFloat(value.replace(",", "."));
}

function buildRadarHistorySummary(bets: BetRow[], language: AppLanguage) {
  const copy = getRadarPageCopy(language);

  if (!bets.length) {
    return copy.noHistoryUseful;
  }

  const metrics = calculateBetMetrics(bets);
  const kindBreakdown = calculateBetKindBreakdown(bets);
  const profitableSport = getMostProfitableSport(bets);

  return [
    `${bets.length} ${copy.tickets}`,
    `${copy.hitRateShort} ${formatPercent(metrics.winRate)}`,
    `net ${formatAmount(metrics.net)}`,
    `${copy.bestSportShort} ${profitableSport}`,
    `${copy.singlesShort} ${kindBreakdown.single.count}`,
    `${copy.combosShort} ${kindBreakdown.combo.count}`,
  ].join(". ");
}

function buildRecentSettledResults(bets: BetRow[], language: AppLanguage) {
  const copy = getRadarPageCopy(language);

  return [...bets]
    .filter((bet) => bet.status !== "pending")
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 10)
    .map((bet) => {
      if (bet.status === "won") {
        return copy.won;
      }

      if (bet.status === "lost") {
        return copy.lost;
      }

      return "cashout";
    });
}

function buildRadarDisciplineInput(bets: BetRow[], language: AppLanguage) {
  const copy = getRadarPageCopy(language);

  if (!bets.length) {
    return {
      statsSummary: copy.noHistoryDiscipline,
      recentResults: [],
    };
  }

  const metrics = calculateBetMetrics(bets);
  const kindBreakdown = calculateBetKindBreakdown(bets);
  const averageStake = calculateAverageStake(bets);
  const profitableSport = getMostProfitableSport(bets);
  const worstLosingStreak = getWorstLosingStreak(bets);
  const settledCount = bets.filter((bet) => bet.status !== "pending").length;

  return {
    statsSummary: [
      `${copy.totalVolume} ${bets.length} ${copy.tickets}`,
      `${copy.settledBets} ${settledCount}`,
      `${copy.openBets} ${metrics.pendingCount}`,
      `${copy.hitRate} ${formatPercent(metrics.winRate)}`,
      `${copy.roi} ${formatPercent(metrics.roi, true)}`,
      `${copy.netResult} ${formatAmount(metrics.net)}`,
      `${copy.averageStake} ${formatAmount(averageStake)}`,
      `${copy.openExposure} ${formatAmount(metrics.openExposure)}`,
      `${copy.averageOdds} ${metrics.averageOdds.toFixed(2)}`,
      `${copy.mostPlayedSport} ${metrics.favoriteSport}`,
      `${copy.mostProfitableSport} ${profitableSport}`,
      `${copy.worstLosingStreak} ${worstLosingStreak}`,
      `${getBetKindLabel("single")} ${kindBreakdown.single.count} ${copy.tickets}, net ${formatAmount(kindBreakdown.single.net)}, ${copy.hitRate.toLowerCase()} ${formatPercent(kindBreakdown.single.winRate)}`,
      `${getBetKindLabel("combo")} ${kindBreakdown.combo.count} ${copy.tickets}, net ${formatAmount(kindBreakdown.combo.net)}, ${copy.hitRate.toLowerCase()} ${formatPercent(kindBreakdown.combo.winRate)}, ${copy.averageEvents} ${kindBreakdown.combo.averageEventCount.toFixed(1)} ${copy.events}`,
    ].join(". "),
    recentResults: buildRecentSettledResults(bets, language),
  };
}

function RadarSkeleton({ accentColor }: { accentColor: string }) {
  return (
    <div className="surface hairline rounded-[22px] px-4 py-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="h-3 w-28 rounded-full bg-white/7" />
          <div className="mt-4 space-y-2">
            <div className="h-4 w-5/6 rounded-full bg-white/8" />
            <div className="h-4 w-4/6 rounded-full bg-white/8" />
          </div>
        </div>
        <div className="h-8 w-20 rounded-full" style={{ backgroundColor: accentColor }} />
      </div>
      <div className="mt-4 rounded-[16px] bg-white/4 px-3 py-3">
        <div className="h-3 w-16 rounded-full bg-white/7" />
        <div className="mt-3 h-3 w-full rounded-full bg-white/7" />
        <div className="mt-2 h-3 w-4/5 rounded-full bg-white/7" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="h-3 w-32 rounded-full bg-white/7" />
        <div className="h-9 w-28 rounded-full bg-white/8" />
      </div>
    </div>
  );
}

function MetaPill({ children }: { children: string }) {
  return <div className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-muted-foreground">{children}</div>;
}

function DisciplinePanel({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "warning" | "neutral";
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-[20px] border px-4 py-4",
        tone === "positive" && "border-positive/18 bg-positive/8",
        tone === "warning" && "border-warning/18 bg-warning/8",
        tone === "neutral" && "border-white/6 bg-white/4",
      )}
    >
      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <p key={`${title}-${item}`} className="text-sm leading-6 text-muted-foreground">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function ModeSwitch({
  value,
  onChange,
}: {
  value: RadarDateMode;
  onChange: (nextValue: RadarDateMode) => void;
}) {
  const language = useLanguageStore((state) => state.language);
  const copy = getRadarPageCopy(language);

  return (
    <div className="grid grid-cols-2 gap-1 rounded-[16px] bg-white/4 p-1">
      {(["day", "range"] as RadarDateMode[]).map((option) => (
        <button
          key={option}
          type="button"
          className={cn(
            "rounded-[12px] px-3 py-2 text-sm font-medium transition",
            value === option ? "bg-white/8 text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(option)}
        >
          {copy.dateModes[option]}
        </button>
      ))}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  index,
  analysisSport,
  analysisWindowLabel,
  accentBackground,
  accentColor,
  accentBorder,
  onSave,
}: {
  suggestion: RadarSuggestion;
  index: number;
  analysisSport: RadarSport;
  analysisWindowLabel: string;
  accentBackground: string;
  accentColor: string;
  accentBorder: string;
  onSave: () => void;
}) {
  const language = useLanguageStore((state) => state.language);
  const copy = getRadarPageCopy(language);

  return (
    <div className="surface hairline rounded-[22px] px-4 py-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            {suggestion.label || `Suggestion ${index + 1}`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {analysisSport} - {analysisWindowLabel}
          </p>
          <div className="mt-4 space-y-2">
            {suggestion.legs.map((leg) => (
              <div key={`${leg.event}-${leg.pick}`} className="rounded-[16px] bg-white/4 px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{leg.competition}</p>
                <p className="mt-1 text-sm font-medium text-foreground">{leg.event}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="muted" className="border-0">
                    {formatRadarEventDateLabel(leg.eventDate)}
                  </Badge>
                  <Badge variant="muted" className="border-0">
                    {leg.market}
                  </Badge>
                  <Badge
                    className="border-0"
                    style={{
                      backgroundColor: accentBackground,
                      color: accentColor,
                    }}
                  >
                    {leg.pick}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Badge
          className="shrink-0 border-0"
          style={{
            backgroundColor: accentBackground,
            color: accentColor,
          }}
        >
          {suggestion.odds}
        </Badge>
      </div>

      <div className="mt-4 rounded-[18px] border px-3 py-3" style={{ borderColor: accentBorder }}>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{copy.reading}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{suggestion.rationale}</p>
        <p className="mt-3 text-xs leading-5 text-muted-foreground/90">{copy.caution}: {suggestion.caution}</p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{copy.bookmakerOddsEditable}</p>
        <Button variant="warning" size="sm" className="rounded-full" onClick={onSave}>
          <BookmarkPlus className="mr-2 h-4 w-4" />
          {copy.save}
        </Button>
      </div>
    </div>
  );
}

export function RadarPage() {
  const language = useLanguageStore((state) => state.language);
  const copy = getRadarPageCopy(language);
  const navigate = useNavigate();
  const session = useAuthStore((state) => state.session);
  const { bets, refresh: refreshBets } = useBets();
  const [sport, setSport] = useState<RadarSport>("Football");
  const [riskIndex, setRiskIndex] = useState(1);
  const [dateMode, setDateMode] = useState<RadarDateMode>("day");
  const [selectedDate, setSelectedDate] = useState(getRelativeDateInputValue(0));
  const [rangeStart, setRangeStart] = useState(getRelativeDateInputValue(0));
  const [rangeEnd, setRangeEnd] = useState(getRelativeDateInputValue(2));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [suggestions, setSuggestions] = useState<RadarSuggestion[]>([]);
  const [analysisRisk, setAnalysisRisk] = useState<RadarRiskValue>("balanced");
  const [analysisSport, setAnalysisSport] = useState<RadarSport>("Football");
  const [analysisWindowLabel, setAnalysisWindowLabel] = useState(
    formatRadarWindowLabel(getRelativeDateInputValue(0), getRelativeDateInputValue(0)),
  );
  const [analysisWindowShifted, setAnalysisWindowShifted] = useState(false);
  const [analysisWindowNote, setAnalysisWindowNote] = useState("");
  const [usageStatus, setUsageStatus] = useState<RadarUsageStatus | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<RadarSuggestion | null>(null);
  const [bookmakerOdds, setBookmakerOdds] = useState("");
  const [stakeAmount, setStakeAmount] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingSuggestion, setIsSavingSuggestion] = useState(false);
  const [isCreditsModalOpen, setIsCreditsModalOpen] = useState(false);
  const [disciplineAnalysis, setDisciplineAnalysis] = useState<RadarDisciplineAnalysis | null>(null);
  const [disciplineError, setDisciplineError] = useState<string | null>(null);
  const [isAnalyzingDiscipline, setIsAnalyzingDiscipline] = useState(false);

  const requestedWindow = useMemo(
    () => normalizeRadarWindow(dateMode, selectedDate, rangeStart, rangeEnd),
    [dateMode, selectedDate, rangeStart, rangeEnd],
  );
  const requestedWindowLabel = useMemo(
    () => formatRadarWindowLabel(requestedWindow.startDate, requestedWindow.endDate),
    [requestedWindow.endDate, requestedWindow.startDate],
  );
  const risk: RadarRiskValue = radarRiskLevels[riskIndex]?.value ?? "balanced";
  const riskMeta = useMemo(() => getRiskMeta(risk), [risk]);
  const analysisRiskMeta = useMemo(() => getRiskMeta(analysisRisk), [analysisRisk]);
  const historySummary = useMemo(() => buildRadarHistorySummary(bets, language), [bets, language]);
  const disciplineInput = useMemo(() => buildRadarDisciplineInput(bets, language), [bets, language]);
  const disciplineMetrics = useMemo(() => calculateBetMetrics(bets), [bets]);
  const disciplineSettledCount = useMemo(() => bets.filter((bet) => bet.status !== "pending").length, [bets]);
  const parsedBookmakerOdds = parseDecimal(bookmakerOdds);
  const parsedStakeAmount = parseDecimal(stakeAmount);
  const isRadarLimitReached = Boolean(usageStatus && usageStatus.canUseRadar === false);
  const shouldShowTokenCta = Boolean(usageStatus && usageStatus.remainingCount <= 0 && usageStatus.tokenBalance <= 0);
  const canAnalyzeDiscipline = Boolean(session?.user) && bets.length >= 3;
  const canSaveSuggestion =
    Boolean(session?.user) &&
    Boolean(selectedSuggestion) &&
    Number.isFinite(parsedBookmakerOdds) &&
    parsedBookmakerOdds > 0 &&
    Number.isFinite(parsedStakeAmount) &&
    parsedStakeAmount > 0;

  useEffect(() => {
    let isCancelled = false;

    async function loadUsageStatus() {
      if (!session?.user) {
        setUsageStatus(null);
        return;
      }

      setIsLoadingUsage(true);

      try {
        const nextStatus = await getRadarUsageStatus(session.user.id);

        if (!isCancelled) {
          setUsageStatus(nextStatus);
        }
      } catch {
        if (!isCancelled) {
          setUsageStatus(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingUsage(false);
        }
      }
    }

    void loadUsageStatus();

    return () => {
      isCancelled = true;
    };
  }, [session?.user?.id]);

  async function refreshUsageStatus() {
    if (!session?.user) {
      setUsageStatus(null);
      return;
    }

    try {
      const nextStatus = await getRadarUsageStatus(session.user.id);
      setUsageStatus(nextStatus);
    } catch {
      // Ignore manual refresh errors in Radar.
    }
  }

  useEffect(() => {
    if (!selectedSuggestion) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSavingSuggestion) {
        setSelectedSuggestion(null);
        setBookmakerOdds("");
        setStakeAmount("");
        setSaveError(null);
      }
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSavingSuggestion, selectedSuggestion]);

  function openSaveSheet(suggestion: RadarSuggestion) {
    setSelectedSuggestion(suggestion);
    setBookmakerOdds(suggestion.odds);
    setStakeAmount("");
    setSaveError(null);
    setSaveMessage(null);
  }

  function closeSaveSheet() {
    if (isSavingSuggestion) {
      return;
    }

    setSelectedSuggestion(null);
    setBookmakerOdds("");
    setStakeAmount("");
    setSaveError(null);
  }

  async function handleAnalyze() {
    if (!session?.user) {
      setHasSubmitted(true);
      setSuggestions([]);
      setError(copy.signIn);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSaveMessage(null);
    setHasSubmitted(true);
    setAnalysisWindowShifted(false);
    setAnalysisWindowNote("");

    try {
      const result = await fetchRadarSuggestions({
        sport,
        risk,
        startDate: requestedWindow.startDate,
        endDate: requestedWindow.endDate,
        historySummary,
        language,
      });

      setAnalysisRisk(risk);
      setAnalysisSport(sport);
      setAnalysisWindowLabel(formatRadarWindowLabel(result.window.startDate, result.window.endDate));
      setAnalysisWindowShifted(result.window.shifted);
      setAnalysisWindowNote(result.window.note);
      setSuggestions(result.suggestions);
      setUsageStatus(result.usage ?? null);
    } catch (nextError) {
      await refreshUsageStatus();

      setSuggestions([]);
      setAnalysisWindowShifted(false);
      setAnalysisWindowNote("");
      setError(getErrorMessage(nextError, copy.analysisUnavailable));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveSuggestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedSuggestion || !session?.user || !canSaveSuggestion) {
      return;
    }

    setIsSavingSuggestion(true);
    setSaveError(null);

    try {
      const isCombo = selectedSuggestion.legs.length > 1;

      await createBet(session.user.id, {
        sport: analysisSport,
        matchLabel: selectedSuggestion.legs.map((leg) => `${leg.event} - ${leg.pick}`).join(" + "),
        betKind: isCombo ? "combo" : "single",
        eventCount: isCombo ? selectedSuggestion.legs.length : 1,
        minOdds: null,
        maxOdds: null,
        stake: parsedStakeAmount,
        odds: parsedBookmakerOdds,
        status: "pending",
      });

      await refreshBets();
      setSelectedSuggestion(null);
      setBookmakerOdds("");
      setStakeAmount("");
      setSaveMessage(copy.addedToJournal);
    } catch (nextError) {
      setSaveError(getErrorMessage(nextError, copy.saveComboUnavailable));
    } finally {
      setIsSavingSuggestion(false);
    }
  }

  async function handleAnalyzeDiscipline() {
    if (!session?.user) {
      setDisciplineAnalysis(null);
      setDisciplineError(copy.signIn);
      return;
    }

    if (!canAnalyzeDiscipline) {
      setDisciplineAnalysis(null);
      setDisciplineError(copy.needThreeTickets);
      return;
    }

    setIsAnalyzingDiscipline(true);
    setDisciplineError(null);

    try {
      const result = await fetchRadarDisciplineAnalysis({ ...disciplineInput, language });
      setDisciplineAnalysis(result);
    } catch (nextError) {
      setDisciplineAnalysis(null);
      setDisciplineError(getErrorMessage(nextError, copy.disciplineUnavailable));
    } finally {
      setIsAnalyzingDiscipline(false);
    }
  }

  return (
    <>
      <PageShell>
        <div className="surface hairline rounded-[24px] px-4 py-4 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{copy.suggestions}</p>
              <p className="mt-2 text-sm font-medium text-foreground">{copy.suggestionsSubtitle}</p>
            </div>

            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: riskMeta.backgroundColor, color: riskMeta.color }}
            >
              <Sparkles className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Select value={sport} onChange={(event) => setSport(event.target.value as RadarSport)}>
                {radarSports.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>

              <Button
                size="lg"
                className="min-w-[8.5rem]"
                onClick={handleAnalyze}
                disabled={isLoading || isLoadingUsage || isRadarLimitReached}
              >
                {isLoading ? (
                  <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    {copy.analyzeLoading}
                  </>
                ) : isLoadingUsage ? (
                  copy.quotaLoading
                ) : isRadarLimitReached ? (
                  copy.limitReached
                ) : (
                  copy.analyze
                )}
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
              <ModeSwitch value={dateMode} onChange={setDateMode} />

              {dateMode === "day" ? (
                <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
                  <Input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
                </div>
              )}
            </div>

            <div className="rounded-[18px] bg-white/4 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-foreground">{copy.risk}</p>
                <Badge
                  className="border-0"
                  style={{
                    backgroundColor: riskMeta.backgroundColor,
                    color: riskMeta.color,
                  }}
                >
                  {getRiskLabel(risk, language)}
                </Badge>
              </div>

              <input
                type="range"
                min="0"
                max={String(radarRiskLevels.length - 1)}
                step="1"
                value={riskIndex}
                onChange={(event) => setRiskIndex(Number(event.target.value))}
                className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/8"
                style={{ accentColor: riskMeta.color }}
              />

              <div className="mt-3 grid grid-cols-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {radarRiskLevels.map((level, index) => (
                  <span
                    key={level.value}
                    className={cn(
                      "transition",
                      index === 0 && "text-left",
                      index === 1 && "text-center",
                      index === 2 && "text-right",
                      level.value === risk ? "font-semibold text-foreground" : "opacity-70",
                    )}
                  >
                    {getRiskLabel(level.value, language)}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <MetaPill>{`${copy.dates} ${requestedWindowLabel}`}</MetaPill>
              {usageStatus ? <MetaPill>{`${copy.thisWeek} ${usageStatus.usedCount}/${usageStatus.limit}`}</MetaPill> : null}
              {usageStatus ? <MetaPill>{`${copy.tokens} ${usageStatus.tokenBalance}`}</MetaPill> : null}
              <Button size="sm" className={buyTokensButtonClass} onClick={() => setIsCreditsModalOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                {copy.buyTokens}
              </Button>
            </div>

            <p className="px-1 text-xs leading-5 text-muted-foreground">
              {usageStatus?.nextAccessMode === "token"
                ? copy.nextUsesToken
                : copy.weeklyQuota}
            </p>
          </div>
        </div>

        {shouldShowTokenCta ? (
          <div className="rounded-[20px] border border-warning/18 bg-warning/8 px-4 py-4 shadow-soft">
            <p className="text-sm text-foreground">{copy.quotaReachedTitle}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {copy.quotaReachedDescription}
            </p>
            <Button size="sm" className={`mt-3 ${buyTokensButtonClass}`} onClick={() => setIsCreditsModalOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" />
              {copy.buyTokens}
            </Button>
          </div>
        ) : null}

        {saveMessage ? (
          <div className="rounded-[20px] border border-positive/18 bg-positive/8 px-4 py-4 shadow-soft">
            <p className="text-sm text-foreground">{saveMessage}</p>
            <Button variant="positive" size="sm" className="mt-3 rounded-full" onClick={() => navigate("/journal")}>
              {copy.viewJournal}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ) : null}

        <div className="surface hairline rounded-[24px] px-4 py-4 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{copy.discipline}</p>
              <p className="mt-2 text-sm font-medium text-foreground">{copy.disciplineSubtitle}</p>
            </div>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/6 text-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <MetaPill>{`${bets.length} ${copy.tickets}`}</MetaPill>
            <MetaPill>{`${copy.settledShort} ${disciplineSettledCount}`}</MetaPill>
            <MetaPill>{`${copy.hitRate} ${formatPercent(disciplineMetrics.winRate)}`}</MetaPill>
            <MetaPill>{`${copy.balance} ${formatAmount(disciplineMetrics.net)}`}</MetaPill>
          </div>

          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {copy.disciplineHint}
          </p>

          <Button
            size="lg"
            className="mt-4 w-full rounded-[18px] shadow-soft"
            onClick={handleAnalyzeDiscipline}
            disabled={isAnalyzingDiscipline || !canAnalyzeDiscipline}
          >
            {isAnalyzingDiscipline ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                {copy.analyzingHistory}
              </>
            ) : (
              copy.analyzeHistory
            )}
          </Button>

          {!canAnalyzeDiscipline ? (
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {copy.reliableTipsHint}
            </p>
          ) : null}

          {disciplineError ? <p className="mt-3 text-sm text-negative/90">{disciplineError}</p> : null}

          {disciplineAnalysis ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-[20px] border border-white/6 bg-white/4 px-4 py-4">
                <p className="text-sm leading-6 text-foreground">{disciplineAnalysis.summary}</p>
              </div>

              <DisciplinePanel title={copy.strengths} items={disciplineAnalysis.strengths} tone="positive" />
              <DisciplinePanel title={copy.warnings} items={disciplineAnalysis.warnings} tone="warning" />
              <DisciplinePanel title={copy.weekActions} items={disciplineAnalysis.actions} tone="neutral" />
            </div>
          ) : null}
        </div>

        {analysisWindowShifted || Boolean(analysisWindowNote) ? (
          <div className="rounded-[20px] border border-warning/18 bg-warning/8 px-4 py-4 shadow-soft">
            <p className="text-sm text-foreground">
              {analysisWindowShifted
                ? `${copy.shiftedWindowFound} ${analysisWindowLabel}.`
                : copy.nothingOnDate}
            </p>
            {analysisWindowNote ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{analysisWindowNote}</p> : null}
          </div>
        ) : null}

        {error ? <p className="px-1 text-sm text-negative/90">{error}</p> : null}

        {isLoading ? (
          <div className="space-y-3">
            <RadarSkeleton accentColor={riskMeta.backgroundColor} />
            <RadarSkeleton accentColor={riskMeta.backgroundColor} />
            <RadarSkeleton accentColor={riskMeta.backgroundColor} />
          </div>
        ) : null}

        {isLoading === false && hasSubmitted && suggestions.length > 0 ? (
          <div className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <SuggestionCard
                key={`${suggestion.odds}-${index}`}
                suggestion={suggestion}
                index={index}
                analysisSport={analysisSport}
                analysisWindowLabel={analysisWindowLabel}
                accentBackground={analysisRiskMeta.backgroundColor}
                accentColor={analysisRiskMeta.color}
                accentBorder={analysisRiskMeta.borderColor}
                onSave={() => openSaveSheet(suggestion)}
              />
            ))}

            <p className="px-1 text-xs text-muted-foreground">{copy.verifyDatesOdds}</p>
          </div>
        ) : null}

        {isLoading === false && hasSubmitted && suggestions.length === 0 && error === null ? (
          <div className="surface hairline rounded-[20px] px-4 py-5 shadow-soft">
            <p className="text-sm text-muted-foreground">{copy.noSuggestion}</p>
          </div>
        ) : null}
      </PageShell>

      <AnimatePresence>
        {selectedSuggestion ? (
          <>
            <motion.button
              type="button"
              aria-label={copy.close}
              className="fixed inset-0 z-40 bg-background/56 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              onClick={closeSaveSheet}
            />

            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md px-3 pb-4"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 28 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <div className="surface hairline rounded-[28px] px-4 pb-5 pt-3 shadow-soft">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-white/10" />

                <div className="mt-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-foreground">{copy.addToJournalTitle}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{copy.enterOddsStake}</p>
                  </div>

                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-muted-foreground transition hover:text-foreground"
                    onClick={closeSaveSheet}
                    aria-label={copy.close}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 rounded-[20px] border border-white/5 bg-white/4 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      {selectedSuggestion.legs.map((leg) => (
                        <div key={`${leg.event}-${leg.pick}`} className="rounded-[14px] bg-white/4 px-3 py-2.5">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{leg.competition}</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{leg.event}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatRadarEventDateLabel(leg.eventDate)} - {leg.market} - {leg.pick}
                          </p>
                        </div>
                      ))}
                    </div>

                    <Badge
                      className="shrink-0 border-0"
                      style={{
                        backgroundColor: analysisRiskMeta.backgroundColor,
                        color: analysisRiskMeta.color,
                      }}
                    >
                      {copy.estimated} {selectedSuggestion.odds}
                    </Badge>
                  </div>
                </div>

                <form className="mt-5 space-y-3" onSubmit={handleSaveSuggestion}>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder={copy.bookmakerOdds}
                    value={bookmakerOdds}
                    onChange={(event) => setBookmakerOdds(event.target.value)}
                  />

                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder={copy.stake}
                    value={stakeAmount}
                    onChange={(event) => setStakeAmount(event.target.value)}
                  />

                  {saveError ? <p className="px-1 text-sm text-negative/90">{saveError}</p> : null}

                  <Button type="submit" size="lg" className="w-full" disabled={isSavingSuggestion || !canSaveSuggestion}>
                    {isSavingSuggestion ? copy.saving : copy.addToJournal}
                  </Button>
                </form>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <RadarCreditsModal
        isOpen={isCreditsModalOpen}
        onClose={() => setIsCreditsModalOpen(false)}
        usageStatus={usageStatus}
        sessionEmail={session?.user.email ?? ""}
        onRedeemed={refreshUsageStatus}
      />
    </>
  );
}
