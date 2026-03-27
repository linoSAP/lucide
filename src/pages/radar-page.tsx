import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BookmarkPlus, LoaderCircle, Sparkles, X } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  calculateBetKindBreakdown,
  calculateBetMetrics,
  createBet,
  getMostProfitableSport,
} from "@/lib/bets";
import { formatAmountValue, formatPercent } from "@/lib/format";
import { useBets } from "@/hooks/use-bets";
import {
  RADAR_DAILY_LIMIT,
  fetchRadarSuggestions,
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
import type { BetRow } from "@/types/supabase";

type RadarDateMode = "day" | "range";

const radarDateModeOptions: Array<{ value: RadarDateMode; label: string }> = [
  { value: "day", label: "Jour" },
  { value: "range", label: "Plage" },
];

const dateLabelFormatter = new Intl.DateTimeFormat("fr-CM", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const eventDateLabelFormatter = new Intl.DateTimeFormat("fr-CM", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

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
  const startLabel = dateLabelFormatter.format(new Date(`${startDate}T12:00:00`));
  const endLabel = dateLabelFormatter.format(new Date(`${endDate}T12:00:00`));

  return startDate === endDate ? startLabel : `${startLabel} - ${endLabel}`;
}

function formatRadarEventDateLabel(eventDate: string) {
  return eventDateLabelFormatter.format(new Date(`${eventDate}T12:00:00`));
}

function parseDecimal(value: string) {
  return Number.parseFloat(value.replace(",", "."));
}

function buildRadarHistorySummary(bets: BetRow[]) {
  if (!bets.length) {
    return "Aucun historique utilisateur disponible pour le moment.";
  }

  const metrics = calculateBetMetrics(bets);
  const kindBreakdown = calculateBetKindBreakdown(bets);
  const profitableSport = getMostProfitableSport(bets);

  return [
    `${bets.length} ticket(s)`,
    `${formatPercent(metrics.winRate)} de reussite`,
    `bilan ${formatAmountValue(metrics.net)} FCFA`,
    `sport rentable ${profitableSport}`,
    `${kindBreakdown.combo.count} combine(s)`,
    `${kindBreakdown.single.count} simple(s)`,
  ].join(". ");
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

function ModeSwitch({
  value,
  onChange,
}: {
  value: RadarDateMode;
  onChange: (nextValue: RadarDateMode) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-[16px] bg-white/4 p-1">
      {radarDateModeOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            "rounded-[12px] px-3 py-2 text-sm font-medium transition",
            value === option.value ? "bg-white/8 text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
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
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Lecture</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{suggestion.rationale}</p>
        <p className="mt-3 text-xs leading-5 text-muted-foreground/90">Vigilance: {suggestion.caution}</p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Cote bookmaker editable avant ajout.</p>
        <Button variant="warning" size="sm" className="rounded-full" onClick={onSave}>
          <BookmarkPlus className="mr-2 h-4 w-4" />
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

export function RadarPage() {
  const navigate = useNavigate();
  const session = useAuthStore((state) => state.session);
  const { bets, refresh: refreshBets } = useBets(40);
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingSuggestion, setIsSavingSuggestion] = useState(false);

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
  const historySummary = useMemo(() => buildRadarHistorySummary(bets), [bets]);
  const parsedBookmakerOdds = parseDecimal(bookmakerOdds);
  const isRadarLimitReached = Boolean(usageStatus && usageStatus.remainingCount <= 0);
  const canSaveSuggestion =
    Boolean(session?.user) &&
    Boolean(selectedSuggestion) &&
    Number.isFinite(parsedBookmakerOdds) &&
    parsedBookmakerOdds > 0;

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

  useEffect(() => {
    if (!selectedSuggestion) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSavingSuggestion) {
        setSelectedSuggestion(null);
        setBookmakerOdds("");
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
    setSaveError(null);
    setSaveMessage(null);
  }

  function closeSaveSheet() {
    if (isSavingSuggestion) {
      return;
    }

    setSelectedSuggestion(null);
    setBookmakerOdds("");
    setSaveError(null);
  }

  async function handleAnalyze() {
    if (!session?.user) {
      setHasSubmitted(true);
      setSuggestions([]);
      setError("Connecte-toi.");
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
      });

      setAnalysisRisk(risk);
      setAnalysisSport(sport);
      setAnalysisWindowLabel(formatRadarWindowLabel(result.window.startDate, result.window.endDate));
      setAnalysisWindowShifted(result.window.shifted);
      setAnalysisWindowNote(result.window.note);
      setSuggestions(result.suggestions);
      setUsageStatus(result.usage ?? null);
    } catch (nextError) {
      try {
        const nextStatus = await getRadarUsageStatus(session.user.id);
        setUsageStatus(nextStatus);
      } catch {
        // Ignore quota refresh errors after a failed analysis.
      }

      setSuggestions([]);
      setAnalysisWindowShifted(false);
      setAnalysisWindowNote("");
      setError(nextError instanceof Error ? nextError.message : "Analyse indisponible pour le moment.");
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
        stake: 0,
        odds: parsedBookmakerOdds,
        status: "pending",
      });

      await refreshBets();
      setSelectedSuggestion(null);
      setBookmakerOdds("");
      setSaveMessage("Ajoute au Journal. Complete la mise quand tu veux.");
    } catch (nextError) {
      setSaveError(getErrorMessage(nextError, "Impossible d'enregistrer ce combine pour le moment."));
    } finally {
      setIsSavingSuggestion(false);
    }
  }

  return (
    <>
      <PageShell>
        <div className="surface hairline rounded-[24px] px-4 py-4 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Suggestions</p>
              <p className="mt-2 text-sm font-medium text-foreground">Par date, sans bruit.</p>
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
                    Analyse...
                  </>
                ) : isLoadingUsage ? (
                  "Quota..."
                ) : isRadarLimitReached ? (
                  "Limite atteinte"
                ) : (
                  "Analyser"
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
                <p className="text-sm text-foreground">Risque</p>
                <Badge
                  className="border-0"
                  style={{
                    backgroundColor: riskMeta.backgroundColor,
                    color: riskMeta.color,
                  }}
                >
                  {getRiskLabel(risk)}
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
                    {level.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <MetaPill>{`Dates ${requestedWindowLabel}`}</MetaPill>
              {usageStatus ? <MetaPill>{`Aujourd'hui ${usageStatus.usedCount}/${usageStatus.limit}`}</MetaPill> : null}
            </div>

            <p className="px-1 text-xs leading-5 text-muted-foreground">{RADAR_DAILY_LIMIT} / jour.</p>
          </div>
        </div>

        {saveMessage ? (
          <div className="rounded-[20px] border border-positive/18 bg-positive/8 px-4 py-4 shadow-soft">
            <p className="text-sm text-foreground">{saveMessage}</p>
            <Button variant="positive" size="sm" className="mt-3 rounded-full" onClick={() => navigate("/journal")}>
              Voir le Journal
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ) : null}

        {analysisWindowShifted || Boolean(analysisWindowNote) ? (
          <div className="rounded-[20px] border border-warning/18 bg-warning/8 px-4 py-4 shadow-soft">
            <p className="text-sm text-foreground">
              {analysisWindowShifted
                ? `Rien sur ta date. Fenetre testee: ${analysisWindowLabel}.`
                : "Rien sur cette date."}
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

            <p className="px-1 text-xs text-muted-foreground">Dates et cotes a verifier.</p>
          </div>
        ) : null}

        {isLoading === false && hasSubmitted && suggestions.length === 0 && error === null ? (
          <div className="surface hairline rounded-[20px] px-4 py-5 shadow-soft">
            <p className="text-sm text-muted-foreground">Aucune suggestion sur cette selection.</p>
          </div>
        ) : null}
      </PageShell>

      <AnimatePresence>
        {selectedSuggestion ? (
          <>
            <motion.button
              type="button"
              aria-label="Fermer"
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
                    <p className="text-base font-semibold text-foreground">Ajouter au Journal</p>
                    <p className="mt-1 text-sm text-muted-foreground">Entre la cote.</p>
                  </div>

                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-muted-foreground transition hover:text-foreground"
                    onClick={closeSaveSheet}
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
                      Estimee {selectedSuggestion.odds}
                    </Badge>
                  </div>
                </div>

                <form className="mt-5 space-y-3" onSubmit={handleSaveSuggestion}>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="Cote bookmaker"
                    value={bookmakerOdds}
                    onChange={(event) => setBookmakerOdds(event.target.value)}
                  />

                  {saveError ? <p className="px-1 text-sm text-negative/90">{saveError}</p> : null}

                  <Button type="submit" size="lg" className="w-full" disabled={isSavingSuggestion || !canSaveSuggestion}>
                    {isSavingSuggestion ? "Enregistrement..." : "Ajouter au Journal"}
                  </Button>
                </form>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
