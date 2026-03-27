import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, ReceiptText, X } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createBet,
  getBetKindLabel,
  getBetKindVariant,
  getBetReturnAmount,
  getBetReturnLabel,
  getBetStructureSummary,
  getPayoutForStatus,
  getStatusLabel,
  getStatusVariant,
  isBetPending,
  isComboBet,
  updatePendingBet,
} from "@/lib/bets";
import { formatAmount, formatDateTime, formatOdds } from "@/lib/format";
import { useBets } from "@/hooks/use-bets";
import { getErrorMessage } from "@/lib/utils";
import { useAuthStore } from "@/store/use-auth-store";
import type { BetKind, BetRow, BetStatus } from "@/types/supabase";

type SheetMode = "create" | "update";
type JournalViewMode = "cards" | "grid" | "table";

interface JournalFormState {
  sport: string;
  matchLabel: string;
  betKind: BetKind;
  eventCount: string;
  minOdds: string;
  maxOdds: string;
  stake: string;
  odds: string;
  status: BetStatus;
  cashoutAmount: string;
}

const viewModes: Array<{ value: JournalViewMode; label: string }> = [
  { value: "cards", label: "Cartes" },
  { value: "grid", label: "Grille" },
  { value: "table", label: "Tableau" },
];

const createStatusOptions: Array<{ value: BetStatus; label: string }> = [
  { value: "pending", label: "En cours" },
  { value: "won", label: "Gagne" },
  { value: "lost", label: "Perdu" },
];

const updateStatusOptions: Array<{ value: BetStatus; label: string }> = [
  { value: "pending", label: "En cours" },
  { value: "won", label: "Gagne" },
  { value: "lost", label: "Perdu" },
  { value: "cashed_out", label: "Cashout" },
];

const pageSizeByMode: Record<JournalViewMode, number> = {
  cards: 5,
  grid: 4,
  table: 8,
};

function createInitialForm(): JournalFormState {
  return {
    sport: "Football",
    matchLabel: "",
    betKind: "single",
    eventCount: "2",
    minOdds: "",
    maxOdds: "",
    stake: "",
    odds: "",
    status: "pending",
    cashoutAmount: "",
  };
}

function createFormFromPendingBet(bet: BetRow): JournalFormState {
  return {
    sport: bet.sport,
    matchLabel: bet.match_label,
    betKind: bet.bet_kind,
    eventCount: String(bet.event_count ?? 1),
    minOdds: bet.min_odds ? String(bet.min_odds) : "",
    maxOdds: bet.max_odds ? String(bet.max_odds) : "",
    stake: String(bet.stake),
    odds: String(bet.odds),
    status: "pending",
    cashoutAmount: "",
  };
}

function parseNumberish(value: string) {
  return Number.parseFloat(value.replace(",", "."));
}

function parseIntegerish(value: string) {
  return Number.parseInt(value, 10);
}

function BetAction({
  bet,
  onEdit,
}: {
  bet: BetRow;
  onEdit: (bet: BetRow) => void;
}) {
  if (!isBetPending(bet.status)) {
    return <span className="text-xs text-muted-foreground">Fige</span>;
  }

  return (
    <Button variant="warning" size="sm" className="rounded-full px-3 font-semibold" onClick={() => onEdit(bet)}>
      Mettre a jour
    </Button>
  );
}

function BetMeta({
  bet,
}: {
  bet: BetRow;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Badge variant={getBetKindVariant(bet.bet_kind)}>{getBetKindLabel(bet.bet_kind)}</Badge>
      <p className="text-xs text-muted-foreground">{getBetStructureSummary(bet)}</p>
    </div>
  );
}

function BetCard({
  bet,
  onEdit,
}: {
  bet: BetRow;
  onEdit: (bet: BetRow) => void;
}) {
  return (
    <div className="surface hairline rounded-[18px] px-4 py-3 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{bet.match_label}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{bet.sport}</p>
          <BetMeta bet={bet} />
        </div>
        <Badge variant={getStatusVariant(bet.status)}>{getStatusLabel(bet.status)}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Mise</p>
          <p className="mt-1 tabular text-foreground">{formatAmount(bet.stake)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {isComboBet(bet.bet_kind) ? "Cote totale" : "Cote"}
          </p>
          <p className="mt-1 tabular text-foreground">{formatOdds(bet.odds)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{getBetReturnLabel(bet.status)}</p>
          <p className="mt-1 tabular text-foreground">{formatAmount(getBetReturnAmount(bet))}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{formatDateTime(bet.created_at)}</p>
        <BetAction bet={bet} onEdit={onEdit} />
      </div>
    </div>
  );
}

function BetGridCard({
  bet,
  onEdit,
}: {
  bet: BetRow;
  onEdit: (bet: BetRow) => void;
}) {
  return (
    <div className="surface hairline rounded-[18px] p-4 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-5 text-foreground break-words">{bet.match_label}</p>
        <Badge variant={getStatusVariant(bet.status)} className="shrink-0">
          {getStatusLabel(bet.status)}
        </Badge>
      </div>

      <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{bet.sport}</p>
      <BetMeta bet={bet} />

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Mise</span>
          <span className="tabular text-foreground">{formatAmount(bet.stake)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{isComboBet(bet.bet_kind) ? "Cote totale" : "Cote"}</span>
          <span className="tabular text-foreground">{formatOdds(bet.odds)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{getBetReturnLabel(bet.status)}</span>
          <span className="tabular text-foreground">{formatAmount(getBetReturnAmount(bet))}</span>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <p className="text-[11px] leading-5 text-muted-foreground">{formatDateTime(bet.created_at)}</p>
        {isBetPending(bet.status) ? (
          <Button variant="warning" size="sm" className="w-full font-semibold" onClick={() => onEdit(bet)}>
            Regler ce pari
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function JournalPage() {
  const session = useAuthStore((state) => state.session);
  const { bets, isLoading, error: loadError, refresh } = useBets();
  const [viewMode, setViewMode] = useState<JournalViewMode>("cards");
  const [page, setPage] = useState(1);
  const [sheetMode, setSheetMode] = useState<SheetMode>("create");
  const [editingBet, setEditingBet] = useState<BetRow | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [form, setForm] = useState<JournalFormState>(createInitialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const openCount = bets.filter((bet) => isBetPending(bet.status)).length;
  const settledCount = bets.length - openCount;
  const comboCount = bets.filter((bet) => isComboBet(bet.bet_kind)).length;
  const singleCount = bets.length - comboCount;
  const parsedEventCount = parseIntegerish(form.eventCount);
  const parsedMinOdds = parseNumberish(form.minOdds);
  const parsedMaxOdds = parseNumberish(form.maxOdds);
  const parsedStake = parseNumberish(form.stake);
  const parsedOdds = parseNumberish(form.odds);
  const parsedCashout = parseNumberish(form.cashoutAmount);
  const pageSize = pageSizeByMode[viewMode];
  const pageCount = Math.max(1, Math.ceil(bets.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedBets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return bets.slice(start, start + pageSize);
  }, [bets, currentPage, pageSize]);

  const isCashout = form.status === "cashed_out";
  const isCombo = isComboBet(form.betKind);
  const isCashoutReady = !isCashout || (Number.isFinite(parsedCashout) && parsedCashout > 0);
  const hasComboOddsRange = form.minOdds.trim().length > 0 || form.maxOdds.trim().length > 0;
  const isComboOddsRangeValid =
    !hasComboOddsRange ||
    (Number.isFinite(parsedMinOdds) &&
      parsedMinOdds > 0 &&
      Number.isFinite(parsedMaxOdds) &&
      parsedMaxOdds > 0 &&
      parsedMaxOdds >= parsedMinOdds);
  const isComboReady =
    !isCombo ||
    (Number.isFinite(parsedEventCount) && parsedEventCount >= 2 && isComboOddsRangeValid);
  const previewAmount =
    Number.isFinite(parsedStake) && parsedStake > 0 && Number.isFinite(parsedOdds) && parsedOdds > 0
      ? form.status === "pending"
        ? getPayoutForStatus(parsedStake, parsedOdds, "won")
        : getPayoutForStatus(parsedStake, parsedOdds, form.status, parsedCashout)
      : 0;
  const previewLabel = getBetReturnLabel(form.status);
  const isFormReady =
    Boolean(session?.user) &&
    form.matchLabel.trim().length > 0 &&
    Number.isFinite(parsedStake) &&
    parsedStake > 0 &&
    Number.isFinite(parsedOdds) &&
    parsedOdds > 0 &&
    isComboReady &&
    isCashoutReady &&
    (sheetMode === "create" || Boolean(editingBet));
  const pageStart = bets.length ? (currentPage - 1) * pageSize + 1 : 0;
  const pageEnd = bets.length ? Math.min(currentPage * pageSize, bets.length) : 0;

  useEffect(() => {
    if (!isSheetOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsSheetOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSheetOpen]);

  useEffect(() => {
    setPage(1);
  }, [viewMode]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  function openCreateSheet() {
    setSheetMode("create");
    setEditingBet(null);
    setForm(createInitialForm());
    setSaveError(null);
    setIsSheetOpen(true);
  }

  function openUpdateSheet(bet: BetRow) {
    if (!isBetPending(bet.status)) {
      return;
    }

    setSheetMode("update");
    setEditingBet(bet);
    setForm(createFormFromPendingBet(bet));
    setSaveError(null);
    setIsSheetOpen(true);
  }

  function closeSheet() {
    if (isSubmitting) {
      return;
    }

    setIsSheetOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.user || !isFormReady) {
      return;
    }

    setIsSubmitting(true);
    setSaveError(null);

    const payload = {
      sport: form.sport,
      matchLabel: form.matchLabel.trim(),
      betKind: form.betKind,
      eventCount: isCombo ? parsedEventCount : 1,
      minOdds: isCombo ? parsedMinOdds : null,
      maxOdds: isCombo ? parsedMaxOdds : null,
      stake: parsedStake,
      odds: parsedOdds,
      status: form.status,
      cashoutAmount: isCashout ? parsedCashout : null,
    } as const;

    try {
      if (sheetMode === "create") {
        await createBet(session.user.id, payload);
      } else if (editingBet) {
        await updatePendingBet(session.user.id, editingBet.id, payload);
      }

      setForm(createInitialForm());
      setEditingBet(null);
      setSheetMode("create");
      setIsSheetOpen(false);
      await refresh();
    } catch (error) {
      setSaveError(getErrorMessage(error, "Impossible d'enregistrer pour le moment."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <PageShell className="pb-20">
        <div className="surface hairline rounded-[20px] px-4 py-4 shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Mises recentes</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Classees des plus recentes aux plus anciennes.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-sm">
              <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                En cours
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {openCount}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{bets.length} ticket(s)</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>{settledCount} regle(s)</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>{singleCount} simples</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>{comboCount} combines</span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 rounded-[16px] bg-white/4 p-1">
            {viewModes.map((mode) => (
              <button
                key={mode.value}
                type="button"
                className={
                  viewMode === mode.value
                    ? "rounded-[14px] bg-white/8 px-3 py-2 text-sm font-medium text-foreground transition"
                    : "rounded-[14px] px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                }
                onClick={() => setViewMode(mode.value)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {loadError ? <p className="px-1 text-sm text-negative/90">{loadError}</p> : null}
          {isLoading ? <p className="px-1 text-sm text-muted-foreground">Chargement des mises...</p> : null}

          {isLoading === false && bets.length === 0 ? (
            <div className="surface hairline rounded-[20px] p-5 shadow-soft">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/6 text-foreground">
                <ReceiptText className="h-4 w-4" />
              </div>
              <p className="mt-4 text-base font-semibold text-foreground">Journal vide</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Appuie sur le bouton + pour ajouter ta premiere mise.
              </p>
            </div>
          ) : null}

          {viewMode === "cards" ? pagedBets.map((bet) => <BetCard key={bet.id} bet={bet} onEdit={openUpdateSheet} />) : null}

          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-3">
              {pagedBets.map((bet) => (
                <BetGridCard key={bet.id} bet={bet} onEdit={openUpdateSheet} />
              ))}
            </div>
          ) : null}

          {viewMode === "table" && pagedBets.length > 0 ? (
            <div className="surface hairline overflow-hidden rounded-[20px] shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead className="border-b border-white/5 text-left text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Match</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Structure</th>
                      <th className="px-4 py-3 font-medium">Mise</th>
                      <th className="px-4 py-3 font-medium">Cote</th>
                      <th className="px-4 py-3 font-medium">Retour</th>
                      <th className="px-4 py-3 font-medium">Statut</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedBets.map((bet) => (
                      <tr key={bet.id} className="border-b border-white/5 last:border-b-0">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{bet.match_label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {bet.sport} - {formatDateTime(bet.created_at)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={getBetKindVariant(bet.bet_kind)}>{getBetKindLabel(bet.bet_kind)}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{getBetStructureSummary(bet)}</td>
                        <td className="px-4 py-3 tabular text-foreground">{formatAmount(bet.stake)}</td>
                        <td className="px-4 py-3 tabular text-foreground">{formatOdds(bet.odds)}</td>
                        <td className="px-4 py-3">
                          <p className="tabular text-foreground">{formatAmount(getBetReturnAmount(bet))}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{getBetReturnLabel(bet.status)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={getStatusVariant(bet.status)}>{getStatusLabel(bet.status)}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <BetAction bet={bet} onEdit={openUpdateSheet} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {isLoading === false && bets.length > 0 ? (
            <div className="surface hairline rounded-[18px] px-4 py-3 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {pageStart}-{pageEnd} sur {bets.length}
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={currentPage === 1}
                  >
                    Precedent
                  </Button>
                  <div className="rounded-full bg-white/5 px-3 py-1 text-xs text-muted-foreground">
                    {currentPage}/{pageCount}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                    disabled={currentPage === pageCount}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </PageShell>

      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 mx-auto flex w-full max-w-md justify-end px-4">
        <Button size="icon" className="pointer-events-auto h-14 w-14 rounded-full shadow-soft" onClick={openCreateSheet}>
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <AnimatePresence>
        {isSheetOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Fermer"
              className="fixed inset-0 z-40 bg-background/56 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              onClick={closeSheet}
            />

            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md px-3 pb-4"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 28 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <div className="surface hairline max-h-[84vh] overflow-y-auto rounded-[28px] px-4 pb-5 pt-3 shadow-soft">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-white/10" />

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      {sheetMode === "create" ? "Ajouter une mise" : "Regler le pari"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {previewLabel} <span className="tabular text-foreground">{formatAmount(previewAmount)}</span>
                    </p>
                    {sheetMode === "update" && editingBet ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Seul un pari en cours est modifiable. Ticket cible: {editingBet.match_label}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-muted-foreground transition hover:text-foreground"
                    onClick={closeSheet}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      value={form.sport}
                      onChange={(event) => setForm((current) => ({ ...current, sport: event.target.value }))}
                    >
                      <option value="Football">Football</option>
                      <option value="Basketball">Basketball</option>
                      <option value="Tennis">Tennis</option>
                      <option value="Autre">Autre</option>
                    </Select>

                    <Select
                      value={form.betKind}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          betKind: event.target.value as BetKind,
                          eventCount: event.target.value === "combo" ? current.eventCount || "2" : "1",
                          minOdds: event.target.value === "combo" ? current.minOdds : "",
                          maxOdds: event.target.value === "combo" ? current.maxOdds : "",
                        }))
                      }
                    >
                      <option value="single">Simple</option>
                      <option value="combo">Combine</option>
                    </Select>
                  </div>

                  <Input
                    placeholder="PSG vs Barca"
                    value={form.matchLabel}
                    onChange={(event) => setForm((current) => ({ ...current, matchLabel: event.target.value }))}
                  />

                  {isCombo ? (
                    <div className="grid grid-cols-3 gap-3">
                      <Input
                        type="number"
                        min="2"
                        step="1"
                        inputMode="numeric"
                        placeholder="Nb events"
                        value={form.eventCount}
                        onChange={(event) => setForm((current) => ({ ...current, eventCount: event.target.value }))}
                      />

                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="Cote min"
                        value={form.minOdds}
                        onChange={(event) => setForm((current) => ({ ...current, minOdds: event.target.value }))}
                      />

                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="Cote max"
                        value={form.maxOdds}
                        onChange={(event) => setForm((current) => ({ ...current, maxOdds: event.target.value }))}
                      />
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      placeholder="Mise FCFA"
                      value={form.stake}
                      onChange={(event) => setForm((current) => ({ ...current, stake: event.target.value }))}
                    />

                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder={isCombo ? "Cote totale" : "Cote 2.50"}
                      value={form.odds}
                      onChange={(event) => setForm((current) => ({ ...current, odds: event.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      value={form.status}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          status: event.target.value as BetStatus,
                          cashoutAmount: event.target.value === "cashed_out" ? current.cashoutAmount : "",
                        }))
                      }
                    >
                      {(sheetMode === "create" ? createStatusOptions : updateStatusOptions).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>

                    {isCashout ? (
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        placeholder="Montant cashout"
                        value={form.cashoutAmount}
                        onChange={(event) => setForm((current) => ({ ...current, cashoutAmount: event.target.value }))}
                      />
                    ) : (
                      <div className="rounded-[14px] border border-white/5 bg-white/4 px-4 py-3 text-sm text-muted-foreground">
                        {isCombo ? "Simple ou combine" : "Ticket simple"}
                      </div>
                    )}
                  </div>

                  {isCombo ? (
                    <p className="px-1 text-xs leading-5 text-muted-foreground">
                      Pour un combine, renseigne au minimum le nombre d'evenements et la cote totale. Les cotes min et
                      max restent optionnelles si tu veux juste importer vite.
                    </p>
                  ) : null}

                  {isCashout ? (
                    <p className="px-1 text-xs leading-5 text-muted-foreground">
                      Le cashout remplace le retour calcule et devient le montant reellement recupere.
                    </p>
                  ) : null}

                  {saveError ? <p className="px-1 text-sm text-negative/90">{saveError}</p> : null}

                  <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || !isFormReady}>
                    {isSubmitting
                      ? sheetMode === "create"
                        ? "Enregistrement..."
                        : "Mise a jour..."
                      : sheetMode === "create"
                        ? "Enregistrer"
                        : "Appliquer le changement"}
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
