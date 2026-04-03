import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageShell } from "@/components/layout/page-shell";
import {
  calculateAverageStake,
  calculateBetKindBreakdown,
  calculateBetMetrics,
  getBetKindLabel,
  getCumulativeBalanceSeries,
  getMostProfitableSport,
  getWorstLosingStreak,
} from "@/lib/bets";
import { formatAmount, formatPercent, formatShortDate } from "@/lib/format";
import { useBets } from "@/hooks/use-bets";
import { cn } from "@/lib/utils";
import { useLanguageStore } from "@/store/use-language-store";

function getDashboardCopy(language: "fr" | "en") {
  return language === "en"
    ? {
        avgStake: "Average stake",
        avgStakeDetail: "Average amount committed per bet across the whole journal.",
        bestSport: "Best sport",
        bestSportDetail: "The one standing out the most once bets are settled.",
        worstStreak: "Worst streak",
        worstStreakDetailActive: "consecutive loss(es) on the toughest streak.",
        worstStreakDetailEmpty: "No losing streak in a row for now.",
        successRate: "success rate",
        committedOnSingles: "committed on singles",
        avgEventsPerCombo: "event(s) on average per combo",
        noComboYet: "No combo recorded yet",
        totalStake: "Total stake",
        totalRecovered: "Total returned",
        netResult: "Net result",
        hitRate: "Hit rate",
        cumulativeBalance: "Cumulative balance",
        loadingEvolution: "Loading performance...",
        chartEmpty: "The chart will appear once a few bets have been recorded.",
        balanceTooltip: "Balance",
      }
    : {
        avgStake: "Mise moyenne",
        avgStakeDetail: "Montant moyen engage par pari sur l'ensemble du journal.",
        bestSport: "Sport rentable",
        bestSportDetail: "Celui qui ressort le mieux une fois les tickets regles.",
        worstStreak: "Pire serie",
        worstStreakDetailActive: "defaite(s) consecutives sur la serie la plus dure.",
        worstStreakDetailEmpty: "Aucune serie negative consecutive pour l'instant.",
        successRate: "de reussite",
        committedOnSingles: "engages sur les simples",
        avgEventsPerCombo: "evenement(s) en moyenne par combine",
        noComboYet: "Aucun combine enregistre pour l'instant",
        totalStake: "Total mise",
        totalRecovered: "Total recupere",
        netResult: "Bilan net",
        hitRate: "Reussite",
        cumulativeBalance: "Bilan cumule",
        loadingEvolution: "Chargement de l'evolution...",
        chartEmpty: "Le graphe apparaitra des que quelques mises seront enregistrees.",
        balanceTooltip: "Bilan",
      };
}

interface MetricTileProps {
  label: string;
  value: string;
  suffix?: string;
  tone?: "neutral" | "positive" | "negative";
}

interface FocusCardProps {
  label: string;
  value: string;
  detail: string;
  tone: "positive" | "warning" | "negative";
}

interface KindCardProps {
  label: string;
  value: string;
  detail: string;
  note: string;
  net: number;
  accent: "positive" | "warning";
  rate: number;
}

function MetricTile({ label, value, suffix, tone = "neutral" }: MetricTileProps) {
  return (
    <div className="surface hairline min-w-0 rounded-[20px] px-4 py-4 shadow-soft">
      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <div className="mt-3 flex items-end gap-2">
        <p
          className={cn(
            "min-w-0 text-[clamp(1.05rem,4.8vw,1.65rem)] font-semibold leading-[1.02] tracking-tight tabular font-mono break-words",
            tone === "positive" && "text-positive",
            tone === "negative" && "text-negative",
            tone === "neutral" && "text-foreground",
          )}
        >
          {value}
        </p>
        {suffix ? <span className="pb-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  );
}

function FocusCard({ label, value, detail, tone }: FocusCardProps) {
  return (
    <div
      className={cn(
        "rounded-[20px] border px-4 py-4 shadow-soft",
        tone === "positive" && "border-positive/20 bg-positive/7",
        tone === "warning" && "border-warning/18 bg-warning/7",
        tone === "negative" && "border-negative/18 bg-negative/7",
      )}
    >
      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
    </div>
  );
}

function KindCard({ label, value, detail, note, net, accent, rate }: KindCardProps) {
  const valueTone = net > 0 ? "text-positive" : net < 0 ? "text-negative" : "text-foreground";
  const rateWidth = Math.max(10, Math.min(100, Number.isFinite(rate) ? rate : 0));

  return (
    <div
      className={cn(
        "surface hairline rounded-[20px] px-4 py-4 shadow-soft",
        accent === "positive" && "ring-1 ring-positive/10",
        accent === "warning" && "ring-1 ring-warning/10",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
        <span
          className={cn(
            "h-2.5 w-2.5 rounded-full",
            accent === "positive" ? "bg-positive/80" : "bg-warning/80",
          )}
        />
      </div>
      <p className={cn("mt-3 text-lg font-semibold tabular", valueTone)}>{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
      <p className="mt-1 text-xs text-muted-foreground/80">{note}</p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/6">
        <div
          className={cn("h-full rounded-full transition-[width]", accent === "positive" ? "bg-positive/80" : "bg-warning/80")}
          style={{ width: `${rateWidth}%` }}
        />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const language = useLanguageStore((state) => state.language);
  const copy = getDashboardCopy(language);
  const { bets, isLoading, error } = useBets();

  const metrics = calculateBetMetrics(bets);
  const kindBreakdown = calculateBetKindBreakdown(bets);
  const totalStaked = metrics.totalStake;
  const totalRecovered = metrics.totalPayout;
  const netBalance = metrics.net;
  const winRate = metrics.winRate;
  const chartData = getCumulativeBalanceSeries(bets, formatShortDate);
  const averageStake = calculateAverageStake(bets);
  const mostProfitableSport = getMostProfitableSport(bets);
  const worstLosingStreak = getWorstLosingStreak(bets);
  const latestBalance = chartData.length > 0 ? chartData[chartData.length - 1].balance : netBalance;
  const chartIsPositive = latestBalance >= 0;
  const chartColor = chartIsPositive ? "#00E676" : "#FF5252";

  const focusCards: FocusCardProps[] = [
    {
      label: copy.avgStake,
      value: formatAmount(averageStake),
      detail: copy.avgStakeDetail,
      tone: "positive",
    },
    {
      label: copy.bestSport,
      value: mostProfitableSport,
      detail: copy.bestSportDetail,
      tone: "warning",
    },
    {
      label: copy.worstStreak,
      value: worstLosingStreak > 0 ? `${worstLosingStreak}` : "0",
      detail:
        worstLosingStreak > 0
          ? copy.worstStreakDetailActive
          : copy.worstStreakDetailEmpty,
      tone: "negative",
    },
  ];

  const kindCards: KindCardProps[] = [
    {
      label: getBetKindLabel("single"),
      value: formatAmount(kindBreakdown.single.net),
      detail: `${kindBreakdown.single.count} ${language === "en" ? "bet(s)" : "ticket(s)"} - ${formatPercent(kindBreakdown.single.winRate)} ${copy.successRate}`,
      note: `${formatAmount(kindBreakdown.single.totalStake)} ${copy.committedOnSingles}`,
      net: kindBreakdown.single.net,
      accent: "positive",
      rate: kindBreakdown.single.winRate,
    },
    {
      label: getBetKindLabel("combo"),
      value: formatAmount(kindBreakdown.combo.net),
      detail: `${kindBreakdown.combo.count} ${language === "en" ? "bet(s)" : "ticket(s)"} - ${formatPercent(kindBreakdown.combo.winRate)} ${copy.successRate}`,
      note:
        kindBreakdown.combo.count > 0
          ? `${kindBreakdown.combo.averageEventCount.toFixed(1)} ${copy.avgEventsPerCombo}`
          : copy.noComboYet,
      net: kindBreakdown.combo.net,
      accent: "warning",
      rate: kindBreakdown.combo.winRate,
    },
  ];

  return (
    <PageShell>
      {error ? <p className="px-1 text-sm text-negative/90">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3">
        <MetricTile label={copy.totalStake} value={formatAmount(totalStaked)} />
        <MetricTile label={copy.totalRecovered} value={formatAmount(totalRecovered)} />
        <MetricTile
          label={copy.netResult}
          value={formatAmount(netBalance)}
          tone={netBalance > 0 ? "positive" : netBalance < 0 ? "negative" : "neutral"}
        />
        <MetricTile label={copy.hitRate} value={formatPercent(winRate)} tone={winRate > 50 ? "positive" : "neutral"} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {kindCards.map((card) => (
          <KindCard key={card.label} {...card} />
        ))}
      </div>

      <div className="surface hairline rounded-[24px] px-4 py-4 shadow-soft">
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{copy.cumulativeBalance}</p>

        {isLoading ? <p className="mt-6 text-sm text-muted-foreground">{copy.loadingEvolution}</p> : null}

        {isLoading === false && chartData.length === 0 ? (
          <p className="mt-6 text-sm leading-6 text-muted-foreground">
            {copy.chartEmpty}
          </p>
        ) : null}

        {chartData.length > 0 ? (
          <div className="mt-4 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgb(var(--chart-grid) / 0.08)" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "rgb(var(--muted-foreground) / 0.92)", fontSize: 11 }}
                  minTickGap={20}
                />
                <YAxis hide domain={["auto", "auto"]} />
                <Tooltip
                  cursor={{ stroke: "rgb(var(--chart-grid) / 0.12)", strokeWidth: 1 }}
                  contentStyle={{
                    background: "rgb(var(--card) / 0.96)",
                    border: "1px solid rgb(var(--border) / 0.08)",
                    borderRadius: "16px",
                    color: "rgb(var(--foreground) / 1)",
                    boxShadow: "0 18px 40px rgb(var(--surface-shadow) / 0.14)",
                  }}
                  labelStyle={{ color: "rgb(var(--muted-foreground) / 1)", fontSize: 12 }}
                  formatter={(value) => [formatAmount(Number(value)), copy.balanceTooltip]}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke={chartColor}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: chartColor, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        {focusCards.map((card) => (
          <FocusCard key={card.label} {...card} />
        ))}
      </div>
    </PageShell>
  );
}
