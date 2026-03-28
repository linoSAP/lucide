import type { RadarPaymentMethod } from "@/types/supabase";

export interface RadarAdminCodePayload {
  code: string;
  email: string;
  amountFcfa: number;
  tokenCount: number;
  paymentMethod: RadarPaymentMethod;
  offerLabel: string | null;
  expiresAt: string;
}

async function readJsonOrThrow(response: Response) {
  const rawText = await response.text();
  let payload: { error?: string } | null = null;

  try {
    payload = rawText ? (JSON.parse(rawText) as { error?: string }) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.error ?? rawText;
    throw new Error(message || "Operation admin impossible pour le moment.");
  }

  return payload;
}

export async function loginRadarAdmin(password: string) {
  const response = await fetch("/api/admin/radar/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ password }),
  });

  await readJsonOrThrow(response);
}

export async function logoutRadarAdmin() {
  const response = await fetch("/api/admin/radar/logout", {
    method: "POST",
    credentials: "include",
  });

  await readJsonOrThrow(response);
}

export async function getRadarAdminSession() {
  const response = await fetch("/api/admin/radar/session", {
    method: "GET",
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
  const response = await fetch("/api/admin/radar/generate-code", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(input),
  });

  const payload = (await readJsonOrThrow(response)) as RadarAdminCodePayload | null;

  if (!payload) {
    throw new Error("Generation impossible pour le moment.");
  }

  return payload;
}
