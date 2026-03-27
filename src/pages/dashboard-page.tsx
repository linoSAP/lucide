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
import { formatAmount, formatAmountValue, formatPercent, formatShortDate } from "@/lib/format";
import { useBets } from "@/hooks/use-bets";
import { cn } from "@/lib/utils";

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
      label: "Mise moyenne",
      value: formatAmountValue(averageStake),
      detail: "FCFA par pari sur l'ensemble du journal.",
      tone: "positive",
    },
    {
      label: "Sport rentable",
      value: mostProfitableSport,
      detail: "Celui qui ressort le mieux une fois les tickets regles.",
      tone: "warning",
    },
    {
      label: "Pire serie",
      value: worstLosingStreak > 0 ? `${worstLosingStreak}` : "0",
      detail:
        worstLosingStreak > 0
          ? "defaite(s) consecutives sur la serie la plus dure."
          : "Aucune serie negative consecutive pour l'instant.",
      tone: "negative",
    },
  ];

  const kindCards: KindCardProps[] = [
    {
      label: getBetKindLabel("single"),
      value: formatAmountValue(kindBreakdown.single.net),
      detail: `${kindBreakdown.single.count} ticket(s) - ${formatPercent(kindBreakdown.single.winRate)} de reussite`,
      note: `${formatAmount(kindBreakdown.single.totalStake)} engages sur les simples`,
      net: kindBreakdown.single.net,
      accent: "positive",
      rate: kindBreakdown.single.winRate,
    },
    {
      label: getBetKindLabel("combo"),
      value: formatAmountValue(kindBreakdown.combo.net),
      detail: `${kindBreakdown.combo.count} ticket(s) - ${formatPercent(kindBreakdown.combo.winRate)} de reussite`,
      note:
        kindBreakdown.combo.count > 0
          ? `${kindBreakdown.combo.averageEventCount.toFixed(1)} evenement(s) en moyenne par combine`
          : "Aucun combine enregistre pour l'instant",
      net: kindBreakdown.combo.net,
      accent: "warning",
      rate: kindBreakdown.combo.winRate,
    },
  ];

  return (
    <PageShell>
      {error ? <p className="px-1 text-sm text-negative/90">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3">
        <MetricTile label="Total mise" value={formatAmountValue(totalStaked)} suffix="FCFA" />
        <MetricTile label="Total recupere" value={formatAmountValue(totalRecovered)} suffix="FCFA" />
        <MetricTile
          label="Bilan net"
          value={formatAmountValue(netBalance)}
          suffix="FCFA"
          tone={netBalance > 0 ? "positive" : netBalance < 0 ? "negative" : "neutral"}
        />
        <MetricTile label="Reussite" value={formatPercent(winRate)} tone={winRate > 50 ? "positive" : "neutral"} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {kindCards.map((card) => (
          <KindCard key={card.label} {...card} />
        ))}
      </div>

      <div className="surface hairline rounded-[24px] px-4 py-4 shadow-soft">
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Bilan cumule</p>

        {isLoading ? <p className="mt-6 text-sm text-muted-foreground">Chargement de l'evolution...</p> : null}

        {isLoading === false && chartData.length === 0 ? (
          <p className="mt-6 text-sm leading-6 text-muted-foreground">
            Le graphe apparaitra des que quelques mises seront enregistrees.
          </p>
        ) : null}

        {chartData.length > 0 ? (
          <div className="mt-4 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#666666", fontSize: 11 }}
                  minTickGap={20}
                />
                <YAxis hide domain={["auto", "auto"]} />
                <Tooltip
                  cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
                  contentStyle={{
                    background: "rgba(30, 30, 30, 0.96)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: "16px",
                    color: "#F5F5F5",
                    boxShadow: "0 18px 40px rgba(0, 0, 0, 0.18)",
                  }}
                  labelStyle={{ color: "#888888", fontSize: 12 }}
                  formatter={(value) => [formatAmount(Number(value)), "Bilan"]}
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
