import { getStoredLanguagePreference } from "@/lib/language";
import type { RadarPaymentMethod } from "@/types/supabase";
import { normalizeErrorMessage } from "@/lib/utils";

export interface RadarAdminCodePayload {
  code: string;
  email: string;
  amountFcfa: number;
  tokenCount: number;
  paymentMethod: RadarPaymentMethod;
  offerLabel: string | null;
  expiresAt: string;
}

function getRadarAdminCopy() {
  return getStoredLanguagePreference() === "en"
    ? {
        adminUnavailable: "Admin action is unavailable right now.",
        generationUnavailable: "Generation is unavailable right now.",
      }
    : {
        adminUnavailable: "Operation admin impossible pour le moment.",
        generationUnavailable: "Generation impossible pour le moment.",
      };
}

function buildAdminRequestHeaders() {
  return {
    "Content-Type": "application/json",
    "x-app-language": getStoredLanguagePreference(),
  };
}

async function readJsonOrThrow(response: Response, fallbackMessage = getRadarAdminCopy().adminUnavailable) {
  const rawText = await response.text();
  let payload: { error?: string } | null = null;

  try {
    payload = rawText ? (JSON.parse(rawText) as { error?: string }) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.error ?? rawText;
    throw new Error(normalizeErrorMessage(message || rawText, fallbackMessage));
  }

  return payload;
}

export async function loginRadarAdmin(password: string) {
  const response = await fetch("/api/admin/radar/login", {
    method: "POST",
    headers: buildAdminRequestHeaders(),
    credentials: "include",
    body: JSON.stringify({ password }),
  });

  await readJsonOrThrow(response);
}

export async function logoutRadarAdmin() {
  const response = await fetch("/api/admin/radar/logout", {
    method: "POST",
    headers: {
      "x-app-language": getStoredLanguagePreference(),
    },
    credentials: "include",
  });

  await readJsonOrThrow(response);
}

export async function getRadarAdminSession() {
  const response = await fetch("/api/admin/radar/session", {
    method: "GET",
    headers: {
      "x-app-language": getStoredLanguagePreference(),
    },
    credentials: "include",
  });

  if (response.status === 401) {
    return false;
  }

  await readJsonOrThrow(response);
  return true;
}

export async function generateRadarTokenCode(input: {
  email: string;
  amountFcfa: number;
  tokenCount: number;
  paymentMethod: RadarPaymentMethod;
  offerLabel: string;
}) {
  const copy = getRadarAdminCopy();
  const response = await fetch("/api/admin/radar/generate-code", {
    method: "POST",
    headers: buildAdminRequestHeaders(),
    credentials: "include",
    body: JSON.stringify(input),
  });

  const payload = (await readJsonOrThrow(response, copy.adminUnavailable)) as RadarAdminCodePayload | null;

  if (!payload) {
    throw new Error(copy.generationUnavailable);
  }

  return payload;
}
