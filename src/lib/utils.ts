import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeErrorMessage(message: string | null | undefined, fallback: string) {
  const trimmedMessage = typeof message === "string" ? message.trim() : "";

  if (!trimmedMessage) {
    return fallback;
  }

  const normalizedMessage = trimmedMessage.toLowerCase();

  if (
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("fetch failed") ||
    normalizedMessage.includes("load failed") ||
    normalizedMessage.includes("networkerror") ||
    normalizedMessage.includes("network request failed") ||
    normalizedMessage.includes("network connection was lost") ||
    normalizedMessage.includes("internet connection appears to be offline")
  ) {
    return "Connexion impossible pour le moment. Verifie ta connexion puis relance.";
  }

  if (
    normalizedMessage.includes("aborterror") ||
    normalizedMessage.includes("timed out") ||
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("signal is aborted")
  ) {
    return "La demande a pris trop de temps. Relance dans quelques secondes.";
  }

  if (
    normalizedMessage.includes("request entity too large") ||
    normalizedMessage.includes("payload too large") ||
    normalizedMessage.includes("context length") ||
    normalizedMessage.includes("prompt is too long") ||
    normalizedMessage.includes("input too large") ||
    normalizedMessage.includes("message too long")
  ) {
    return "La demande etait trop lourde pour etre finalisee. Relance simplement.";
  }

  if (
    normalizedMessage.includes("service unavailable") ||
    normalizedMessage.includes("temporarily unavailable") ||
    normalizedMessage.includes("upstream") ||
    normalizedMessage.includes("gateway") ||
    normalizedMessage.includes("overloaded") ||
    normalizedMessage.includes("too many requests")
  ) {
    return "Service temporairement indisponible. Reessaie dans quelques secondes.";
  }

  if (
    normalizedMessage.startsWith("typeerror:") ||
    normalizedMessage.startsWith("syntaxerror:") ||
    normalizedMessage.startsWith("referenceerror:") ||
    normalizedMessage.startsWith("<!doctype") ||
    normalizedMessage.startsWith("<html") ||
    normalizedMessage.includes("unexpected token '<'") ||
    normalizedMessage.includes("syntaxerror: unexpected token '<'")
  ) {
    return fallback;
  }

  return trimmedMessage;
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return normalizeErrorMessage(error.message, fallback);
  }

  if (typeof error === "object" && error && "message" in error) {
    const message = error.message;

    if (typeof message === "string" && message.trim()) {
      return normalizeErrorMessage(message, fallback);
    }
  }

  return fallback;
}
