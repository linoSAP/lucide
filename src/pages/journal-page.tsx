import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, ReceiptText, X } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getStoredCurrencyPreference } from "@/lib/currency";
import type { AppLanguage } from "@/lib/language";
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
import { useLanguageStore } from "@/store/use-language-store";
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

const viewModeValues: JournalViewMode[] = ["cards", "grid", "table"];
const createStatusOptionValues: BetStatus[] = ["pending", "won", "lost"];
const updateStatusOptionValues: BetStatus[] = ["pending", "won", "lost", "cashed_out"];

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

function getJournalCopy(language: AppLanguage) {
  return language === "en"
    ? {
        viewModes: {
          cards: "Cards",
          grid: "Grid",
          table: "Table",
        },
        frozen: "Locked",
        update: "Update",
        stake: "Stake",
        totalOdds: "Total odds",
        odds: "Odds",
        settleThisBet: "Settle this bet",
        recentBets: "Recent bets",
        recentBetsHint: "Sorted from newest to oldest.",
        pending: "Pending",
        settled: "settled",
        singles: "singles",
        combos: "combos",
        loading: "Loading bets...",
        emptyTitle: "Journal is empty",
        emptyDescription: "Tap the + button to add your first bet.",
        match: "Match",
        type: "Type",
        structure: "Structure",
        returned: "Return",
        amount: "Amount",
        status: "Status",
        action: "Action",
        of: "of",
        previous: "Previous",
        next: "Next",
        close: "Close",
        addBet: "Add a bet",
        settleBet: "Settle the bet",
        targetBet: "Only pending bets can be edited. Target bet:",
        saveUnavailable: "Unable to save right now.",
        other: "Other",
        single: "Single",
        combo: "Combo",
        eventCount: "No. events",
        minOdds: "Min odds",
        maxOdds: "Max odds",
        oddsPlaceholder: "Odds 2.50",
        singleOrCombo: "Single or combo",
        singleTicket: "Single ticket",
        comboHint: "For a combo, enter at least the number of events and the total odds. Min and max odds stay optional if you want to log it quickly.",
        cashoutHint: "Cashout replaces the calculated return and becomes the amount actually recovered.",
        saving: "Saving...",
        updating: "Updating...",
        save: "Save",
        applyChange: "Apply change",
      }
    : {
        viewModes: {
          cards: "Cartes",
          grid: "Grille",
          table: "Tableau",
        },
        frozen: "Fige",
        update: "Mettre a jour",
        stake: "Mise",
        totalOdds: "Cote totale",
        odds: "Cote",
        settleThisBet: "Regler ce pari",
        recentBets: "Mises recentes",
        recentBetsHint: "Classees des plus recentes aux plus anciennes.",
        pending: "En cours",
        settled: "regle(s)",
        singles: "simples",
        combos: "combines",
        loading: "Chargement des mises...",
        emptyTitle: "Journal vide",
        emptyDescription: "Appuie sur le bouton + pour ajouter ta premiere mise.",
        match: "Match",
        type: "Type",
        structure: "Structure",
        returned: "Retour",
        amount: "Montant",
        status: "Statut",
        action: "Action",
        of: "sur",
        previous: "Precedent",
        next: "Suivant",
        close: "Fermer",
        addBet: "Ajouter une mise",
        settleBet: "Regler le pari",
        targetBet: "Seul un pari en cours est modifiable. Ticket cible:",
        saveUnavailable: "Impossible d'enregistrer pour le moment.",
        other: "Autre",
        single: "Simple",
        combo: "Combine",
        eventCount: "Nb events",
        minOdds: "Cote min",
        maxOdds: "Cote max",
        oddsPlaceholder: "Cote 2.50",
        singleOrCombo: "Simple ou combine",
        singleTicket: "Ticket simple",
        comboHint: "Pour un combine, renseigne au minimum le nombre d'evenements et la cote totale. Les cotes min et max restent optionnelles si tu veux juste importer vite.",
        cashoutHint: "Le cashout remplace le retour calcule et devient le montant reellement recupere.",
        saving: "Enregistrement...",
        updating: "Mise a jour...",
        save: "Enregistrer",
        applyChange: "Appliquer le changement",
      };
}

function BetAction({
  bet,
  onEdit,
}: {
  bet: BetRow;
  onEdit: (bet: BetRow) => void;
}) {
  const language = useLanguageStore((state) => state.language);
  const copy = getJournalCopy(language);

  if (!isBetPending(bet.status)) {
    return <span className="text-xs text-muted-foreground">{copy.frozen}</span>;
  }

  return (
    <Button variant="warning" size="sm" className="rounded-full px-3 font-semibold" onClick={() => onEdit(bet)}>
      {copy.update}
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
  const language = useLanguageStore((state) => state.language);
  const copy = getJournalCopy(language);

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
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{copy.stake}</p>
          <p className="mt-1 tabular text-foreground">{formatAmount(bet.stake)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {isComboBet(bet.bet_kind) ? copy.totalOdds : copy.odds}
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
  const language = useLanguageStore((state) => state.language);
  const copy = getJournalCopy(language);

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
          <span className="text-muted-foreground">{copy.stake}</span>
          <span className="tabular text-foreground">{formatAmount(bet.stake)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{isComboBet(bet.bet_kind) ? copy.totalOdds : copy.odds}</span>
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
            {copy.settleThisBet}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function JournalPage() {
  const activeCurrencyCode = getStoredCurrencyPreference();
  const language = useLanguageStore((state) => state.language);
  const copy = getJournalCopy(language);
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
      setSaveError(getErrorMessage(error, copy.saveUnavailable));
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
              <p className="text-sm font-medium text-foreground">{copy.recentBets}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {copy.recentBetsHint}
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-sm">
              <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {copy.pending}
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {openCount}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{bets.length} {language === "en" ? "bet(s)" : "ticket(s)"}</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>{settledCount} {copy.settled}</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>{singleCount} {copy.singles}</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>{comboCount} {copy.combos}</span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 rounded-[16px] bg-white/4 p-1">
            {viewModeValues.map((mode) => (
              <button
                key={mode}
                type="button"
                className={
                  viewMode === mode
                    ? "rounded-[14px] bg-white/8 px-3 py-2 text-sm font-medium text-foreground transition"
                    : "rounded-[14px] px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                }
                onClick={() => setViewMode(mode)}
              >
                {copy.viewModes[mode]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {loadError ? <p className="px-1 text-sm text-negative/90">{loadError}</p> : null}
          {isLoading ? <p className="px-1 text-sm text-muted-foreground">{copy.loading}</p> : null}

          {isLoading === false && bets.length === 0 ? (
            <div className="surface hairline rounded-[20px] p-5 shadow-soft">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/6 text-foreground">
                <ReceiptText className="h-4 w-4" />
              </div>
              <p className="mt-4 text-base font-semibold text-foreground">{copy.emptyTitle}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {copy.emptyDescription}
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
                      <th className="px-4 py-3 font-medium">{copy.match}</th>
                      <th className="px-4 py-3 font-medium">{copy.type}</th>
                      <th className="px-4 py-3 font-medium">{copy.structure}</th>
                      <th className="px-4 py-3 font-medium">{copy.stake}</th>
                      <th className="px-4 py-3 font-medium">{copy.odds}</th>
                      <th className="px-4 py-3 font-medium">{copy.returned}</th>
                      <th className="px-4 py-3 font-medium">{copy.status}</th>
                      <th className="px-4 py-3 font-medium">{copy.action}</th>
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
                  {pageStart}-{pageEnd} {copy.of} {bets.length}
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={currentPage === 1}
                  >
                    {copy.previous}
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
                    {copy.next}
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
              aria-label={copy.close}
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
                      {sheetMode === "create" ? copy.addBet : copy.settleBet}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {previewLabel} <span className="tabular text-foreground">{formatAmount(previewAmount)}</span>
                    </p>
                    {sheetMode === "update" && editingBet ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {copy.targetBet} {editingBet.match_label}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-muted-foreground transition hover:text-foreground"
                    onClick={closeSheet}
                    aria-label={copy.close}
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
                      <option value={copy.other}>{copy.other}</option>
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
                      <option value="single">{copy.single}</option>
                      <option value="combo">{copy.combo}</option>
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
                        placeholder={copy.eventCount}
                        value={form.eventCount}
                        onChange={(event) => setForm((current) => ({ ...current, eventCount: event.target.value }))}
                      />

                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        placeholder={copy.minOdds}
                        value={form.minOdds}
                        onChange={(event) => setForm((current) => ({ ...current, minOdds: event.target.value }))}
                      />

                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        placeholder={copy.maxOdds}
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
                      placeholder={`${copy.stake} ${activeCurrencyCode}`}
                      value={form.stake}
                      onChange={(event) => setForm((current) => ({ ...current, stake: event.target.value }))}
                    />

                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder={isCombo ? copy.totalOdds : copy.oddsPlaceholder}
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
                      {(sheetMode === "create" ? createStatusOptionValues : updateStatusOptionValues).map((option) => (
                        <option key={option} value={option}>
                          {getStatusLabel(option)}
                        </option>
                      ))}
                    </Select>

                    {isCashout ? (
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        placeholder={`${copy.amount} ${activeCurrencyCode}`}
                        value={form.cashoutAmount}
                        onChange={(event) => setForm((current) => ({ ...current, cashoutAmount: event.target.value }))}
                      />
                    ) : (
                      <div className="rounded-[14px] border border-white/5 bg-white/4 px-4 py-3 text-sm text-muted-foreground">
                        {isCombo ? copy.singleOrCombo : copy.singleTicket}
                      </div>
                    )}
                  </div>

                  {isCombo ? (
                    <p className="px-1 text-xs leading-5 text-muted-foreground">
                      {copy.comboHint}
                    </p>
                  ) : null}

                  {isCashout ? (
                    <p className="px-1 text-xs leading-5 text-muted-foreground">
                      {copy.cashoutHint}
                    </p>
                  ) : null}

                  {saveError ? <p className="px-1 text-sm text-negative/90">{saveError}</p> : null}

                  <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || !isFormReady}>
                    {isSubmitting
                      ? sheetMode === "create"
                        ? copy.saving
                        : copy.updating
                      : sheetMode === "create"
                        ? copy.save
                        : copy.applyChange}
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
