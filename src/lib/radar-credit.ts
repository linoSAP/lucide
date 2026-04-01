import type { RadarPaymentMethod } from "@/types/supabase";

export const radarPaymentRecipients: Record<RadarPaymentMethod, string> = {
  orange_money: "695749209",
  mobile_money: "673082287",
  wave: "695749209",
};

export const developerWhatsapp = "237693226867";

export const radarPaymentMethodLabels: Record<RadarPaymentMethod, string> = {
  orange_money: "Orange Money",
  mobile_money: "Mobile Money",
  wave: "Wave",
};

export const radarCreditOffers = [
  {
    id: "solo",
    label: "Solo",
    tokenCount: 1,
    amountFcfa: 300,
    tagline: "1 radar de secours",
  },
  {
    id: "starter",
    label: "Starter",
    tokenCount: 3,
    amountFcfa: 800,
    tagline: "3 radars a prix doux",
  },
  {
    id: "pulse",
    label: "Pulse",
    tokenCount: 5,
    amountFcfa: 1300,
    tagline: "Le pack le plus equilibre",
  },
  {
    id: "pro",
    label: "Pro",
    tokenCount: 10,
    amountFcfa: 2400,
    tagline: "Le meilleur prix par radar",
  },
] as const;

export type RadarCreditOffer = (typeof radarCreditOffers)[number];
export type RadarCreditOfferId = RadarCreditOffer["id"];

export function getRadarCreditOffer(offerId: string) {
  return radarCreditOffers.find((offer) => offer.id === offerId) ?? radarCreditOffers[0];
}

export function buildDialHref(code: string) {
  return code ? `tel:${code.replace(/#/g, "%23")}` : "";
}

export function buildRadarPaymentHref(paymentMethod: RadarPaymentMethod, amountFcfa: number) {
  const safeAmount = Number.isFinite(amountFcfa) ? Math.max(0, Math.trunc(amountFcfa)) : 0;

  if (!safeAmount) {
    return "";
  }

  if (paymentMethod === "orange_money") {
    return buildDialHref(`#150*1*1*${radarPaymentRecipients.orange_money}*${safeAmount}#`);
  }

  if (paymentMethod === "mobile_money") {
    return buildDialHref(`*126*9*${radarPaymentRecipients.mobile_money}*${safeAmount}#`);
  }

  return "";
}

export function buildWhatsAppHref(phone: string, message: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function buildRadarPurchaseWhatsAppMessage(options: {
  email: string;
  paymentMethod: RadarPaymentMethod;
  offerLabel: string;
  tokenCount: number;
  amountFcfa: number;
}) {
  return [
    "Bonjour, je confirme mon paiement Radar Lucide.",
    `Email: ${options.email}`,
    `Forfait: ${options.offerLabel}`,
    `Jetons: ${options.tokenCount}`,
    `Montant: ${options.amountFcfa} FCFA`,
    `Paiement: ${radarPaymentMethodLabels[options.paymentMethod]}`,
  ].join("\n");
}

export function buildRadarPurchaseWhatsAppHref(options: {
  email: string;
  paymentMethod: RadarPaymentMethod;
  offerLabel: string;
  tokenCount: number;
  amountFcfa: number;
}) {
  return buildWhatsAppHref(developerWhatsapp, buildRadarPurchaseWhatsAppMessage(options));
}
