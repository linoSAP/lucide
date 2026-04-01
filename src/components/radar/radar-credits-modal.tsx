import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, KeyRound, MessageCircle, Wallet, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RADAR_TOKEN_UNIT_PRICE_FCFA,
  buildRadarPaymentHref,
  buildRadarPurchaseWhatsAppHref,
  getRadarCreditOffer,
  radarCreditOffers,
  radarPaymentMethodLabels,
  radarPaymentRecipients,
  type RadarCreditOfferId,
} from "@/lib/radar-credit";
import { redeemRadarTokenCode, type RadarUsageStatus } from "@/lib/radar";
import { cn } from "@/lib/utils";
import type { RadarPaymentMethod } from "@/types/supabase";

interface RadarCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  usageStatus: RadarUsageStatus | null;
  sessionEmail: string;
  onRedeemed?: () => Promise<void> | void;
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

function sanitizeCodeInput(value: string) {
  return value.toUpperCase().replace(/\s+/g, "").slice(0, 40);
}

function StatusPill({ label }: { label: string }) {
  return <div className="rounded-full bg-black/10 px-3 py-1 text-xs font-medium text-foreground/88">{label}</div>;
}

export function RadarCreditsModal({ isOpen, onClose, usageStatus, sessionEmail, onRedeemed }: RadarCreditsModalProps) {
  const [selectedOfferId, setSelectedOfferId] = useState<RadarCreditOfferId>("pulse");
  const [waveCopyState, setWaveCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemMessage, setRedeemMessage] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const selectedOffer = useMemo(() => getRadarCreditOffer(selectedOfferId), [selectedOfferId]);
  const isBlocked = Boolean(usageStatus && usageStatus.remainingCount <= 0 && usageStatus.tokenBalance <= 0);

  function handleClose() {
    if (isRedeeming) {
      return;
    }

    onClose();
  }

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isRedeeming) {
        onClose();
      }
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isRedeeming, onClose]);

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

  async function handleRedeemCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRedeeming(true);
    setRedeemError(null);
    setRedeemMessage(null);

    try {
      const result = await redeemRadarTokenCode(redeemCode);
      setRedeemCode("");
      setRedeemMessage(`${result.redeemedTokenCount} jeton(s) ajoutes. Solde actuel: ${result.tokenBalance}.`);
      await onRedeemed?.();
    } catch (nextError) {
      setRedeemError(nextError instanceof Error ? nextError.message : "Activation impossible.");
    } finally {
      setIsRedeeming(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.button
            type="button"
            aria-label="Fermer les jetons Radar"
            className="fixed inset-0 z-[60] bg-background/64 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={handleClose}
          />

          <motion.div
            className="fixed inset-x-0 bottom-0 z-[70] mx-auto w-full max-w-md px-3 pb-4"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 28 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="surface hairline max-h-[88vh] overflow-y-auto rounded-[28px] px-4 pb-5 pt-3 shadow-soft">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-white/10" />

              <div className="mt-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-foreground">Jetons Radar</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Acheter un pack ou activer un code sans quitter Radar.
                  </p>
                </div>

                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-muted-foreground transition hover:text-foreground"
                  onClick={handleClose}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <StatusPill label={`Cette semaine ${usageStatus?.usedCount ?? 0}/${usageStatus?.limit ?? 2}`} />
                <StatusPill label={`Jetons ${usageStatus?.tokenBalance ?? 0}`} />
                <StatusPill
                  label={
                    usageStatus?.nextAccessMode === "token"
                      ? "Prochain radar: 1 jeton"
                      : usageStatus?.nextAccessMode === "blocked"
                        ? "Prochain radar: bloque"
                        : "Prochain radar: gratuit"
                  }
                />
              </div>

              {isBlocked ? (
                <div className="mt-4 rounded-[18px] border border-warning/24 bg-warning/10 px-4 py-4">
                  <p className="text-sm font-medium text-foreground">Le quota gratuit de la semaine est termine.</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Choisis un pack, paie, confirme via WhatsApp, puis active le code que tu recevras.
                  </p>
                </div>
              ) : null}

              <div className="mt-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Choisir un pack</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">2 essais gratuits par semaine, puis 1 jeton = 1 analyse.</p>
                  </div>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-primary">
                    <Wallet className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {radarCreditOffers.map((offer) => {
                    const isActive = offer.id === selectedOfferId;

                    return (
                      <button
                        key={offer.id}
                        type="button"
                        className={cn(
                          "rounded-[18px] border px-4 py-4 text-left transition",
                          isActive
                            ? "border-primary/24 bg-primary/10 ring-1 ring-primary/18"
                            : "border-white/6 bg-white/4 hover:bg-white/6",
                        )}
                        onClick={() => setSelectedOfferId(offer.id)}
                      >
                        <p className="text-sm font-semibold text-foreground">{offer.label}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{offer.tagline}</p>
                        <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{offer.tokenCount} jetons</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{offer.amountFcfa} FCFA</p>
                        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                          {offer.unitPriceFcfa} FCFA / jeton
                          {offer.savingsFcfa > 0 ? ` - economie ${offer.savingsFcfa} FCFA` : ""}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-[18px] border border-white/6 bg-white/4 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Pack choisi</p>
                  <p className="mt-1 text-base font-semibold text-foreground">
                    {selectedOffer.label} - {selectedOffer.tokenCount} jetons - {selectedOffer.amountFcfa} FCFA
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Base unitaire {RADAR_TOKEN_UNIT_PRICE_FCFA} FCFA. Ce pack ramene le jeton a {selectedOffer.unitPriceFcfa} FCFA.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Paiement manuel, confirmation WhatsApp, puis activation avec un code a usage unique.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {(["orange_money", "mobile_money"] as RadarPaymentMethod[]).map((paymentMethod) => {
                  const paymentHref = buildRadarPaymentHref(paymentMethod, selectedOffer.amountFcfa);
                  const confirmHref = buildRadarPurchaseWhatsAppHref({
                    email: sessionEmail,
                    paymentMethod,
                    offerLabel: `${selectedOffer.label} - ${selectedOffer.tokenCount} jetons`,
                    tokenCount: selectedOffer.tokenCount,
                    amountFcfa: selectedOffer.amountFcfa,
                  });

                  return (
                    <div
                      key={paymentMethod}
                      className={cn(
                        "rounded-[22px] px-4 py-4",
                        paymentMethod === "orange_money"
                          ? "border border-[#ff8a1e]/24 bg-[linear-gradient(180deg,rgba(255,138,30,0.14),rgba(255,138,30,0.06))]"
                          : "border border-[#ffd248]/24 bg-[linear-gradient(180deg,rgba(255,210,72,0.16),rgba(255,210,72,0.06))]",
                      )}
                    >
                      <p className="text-sm font-semibold text-foreground">{radarPaymentMethodLabels[paymentMethod]}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {selectedOffer.amountFcfa} FCFA pour {selectedOffer.tokenCount} jetons.
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <a
                          href={paymentHref}
                          className={cn(
                            buttonVariants({ size: "default" }),
                            "justify-center rounded-[16px]",
                            paymentMethod === "orange_money"
                              ? "bg-[#ff7900] text-white hover:bg-[#ff8a1f]"
                              : "bg-[#ffd248] text-[#332400] hover:bg-[#ffdc6f]",
                          )}
                        >
                          Payer
                        </a>

                        <a
                          href={confirmHref}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(buttonVariants({ variant: "secondary", size: "default" }), "justify-center rounded-[16px]")}
                        >
                          <MessageCircle className="mr-2 h-4 w-4" />
                          Confirmer
                        </a>
                      </div>
                    </div>
                  );
                })}

                <div className="rounded-[22px] border border-[#5cc8ff]/24 bg-[linear-gradient(180deg,rgba(92,200,255,0.14),rgba(92,200,255,0.05))] px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Wave</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Copie le numero, paie {selectedOffer.amountFcfa} FCFA, puis confirme via WhatsApp.
                      </p>
                    </div>

                    <div className="inline-flex rounded-full bg-black/10 px-3 py-1 text-xs font-medium text-foreground/88">
                      {selectedOffer.amountFcfa} FCFA
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
                          Copier
                        </>
                      )}
                    </Button>
                  </div>

                  <a
                    href={buildRadarPurchaseWhatsAppHref({
                      email: sessionEmail,
                      paymentMethod: "wave",
                      offerLabel: `${selectedOffer.label} - ${selectedOffer.tokenCount} jetons`,
                      tokenCount: selectedOffer.tokenCount,
                      amountFcfa: selectedOffer.amountFcfa,
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(buttonVariants({ variant: "secondary", size: "default" }), "mt-4 flex w-full justify-center rounded-[16px]")}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Confirmer via WhatsApp
                  </a>

                  {waveCopyState === "error" ? <p className="mt-3 text-xs text-negative/90">Copie impossible pour le moment.</p> : null}
                </div>
              </div>

              <form className="mt-5 rounded-[22px] border border-primary/18 bg-primary/8 px-4 py-4" onSubmit={handleRedeemCode}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Activer un code</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Colle ici le code que tu as recu pour crediter tes jetons.
                    </p>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-primary">
                    <KeyRound className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <Input
                    placeholder="LUC-RDR-XXXX-XXXX-XXXX"
                    value={redeemCode}
                    onChange={(event) => setRedeemCode(sanitizeCodeInput(event.target.value))}
                  />
                  <Button type="submit" disabled={isRedeeming}>
                    {isRedeeming ? "Activation..." : "Activer"}
                  </Button>
                </div>

                <div className="mt-3 min-h-[1.25rem]">
                  {redeemMessage ? <p className="text-sm text-positive">{redeemMessage}</p> : null}
                  {redeemError ? <p className="text-sm text-negative/90">{redeemError}</p> : null}
                </div>
              </form>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
