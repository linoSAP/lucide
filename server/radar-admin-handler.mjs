import { createClient } from "@supabase/supabase-js";

const ADMIN_COOKIE_NAME = "lucide_radar_admin";
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12;
const RADAR_CODE_EXPIRY_DAYS = 30;
const allowedPaymentMethods = new Set(["orange_money", "mobile_money", "wave"]);

function sendJson(response, status, payload, extraHeaders = {}) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  for (const [headerName, headerValue] of Object.entries(extraHeaders)) {
    response.setHeader(headerName, headerValue);
  }

  response.end(JSON.stringify(payload));
}

function buildJsonResponse(status, payload, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function getHeaderValue(headers, headerName) {
  if (!headers) {
    return "";
  }

  if (typeof headers.get === "function") {
    return headers.get(headerName) ?? "";
  }

  const normalizedName = headerName.toLowerCase();
  const value = headers[normalizedName] ?? headers[headerName];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return typeof value === "string" ? value : "";
}

function getPathnameFromUrl(requestUrl) {
  if (!requestUrl) {
    return "";
  }

  if (requestUrl.startsWith("http://") || requestUrl.startsWith("https://")) {
    return new URL(requestUrl).pathname;
  }

  return requestUrl.split("?")[0] ?? "";
}

function parseJsonBody(rawBody) {
  try {
    return JSON.parse(rawBody || "{}");
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader) {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separatorIndex = entry.indexOf("=");

        if (separatorIndex <= 0) {
          return [entry, ""];
        }

        return [entry.slice(0, separatorIndex), decodeURIComponent(entry.slice(separatorIndex + 1))];
      }),
  );
}

function buildBase64Url(bytes) {
  let binaryValue = "";

  bytes.forEach((byte) => {
    binaryValue += String.fromCharCode(byte);
  });

  const base64Value =
    typeof btoa === "function" ? btoa(binaryValue) : Buffer.from(binaryValue, "binary").toString("base64");

  return base64Value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function parseBase64Url(value) {
  const normalizedValue = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalizedValue.length % 4 === 0 ? "" : "=".repeat(4 - (normalizedValue.length % 4));
  const binaryValue =
    typeof atob === "function"
      ? atob(`${normalizedValue}${padding}`)
      : Buffer.from(`${normalizedValue}${padding}`, "base64").toString("binary");
  return Uint8Array.from(binaryValue, (char) => char.charCodeAt(0));
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function signAdminSession(secret, payload) {
  const encodedPayload = buildBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signatureHex = await sha256Hex(`${secret}:${encodedPayload}`);
  return `${encodedPayload}.${signatureHex}`;
}

async function readAdminSession(headers, secret) {
  const cookieHeader = getHeaderValue(headers, "cookie");

  if (!cookieHeader) {
    return null;
  }

  const cookies = parseCookies(cookieHeader);
  const token = cookies[ADMIN_COOKIE_NAME];

  if (!token) {
    return null;
  }

  const [encodedPayload, signatureHex] = token.split(".", 2);

  if (!encodedPayload || !signatureHex) {
    return null;
  }

  const expectedSignatureHex = await sha256Hex(`${secret}:${encodedPayload}`);

  if (signatureHex !== expectedSignatureHex) {
    return null;
  }

  let payload = null;

  try {
    payload = JSON.parse(new TextDecoder().decode(parseBase64Url(encodedPayload)));
  } catch {
    return null;
  }

  if (typeof payload?.exp !== "number" || payload.exp <= Date.now()) {
    return null;
  }

  return payload;
}

function buildAdminCookie(value, maxAgeSeconds, requestUrl) {
  const cookieParts = [
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (requestUrl.startsWith("https://")) {
    cookieParts.push("Secure");
  }

  return cookieParts.join("; ");
}

function createServiceSupabaseClient(supabaseUrl, serviceRoleKey) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeSafeLabel(value) {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function buildRandomRadarCode() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const characters = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  const segments = characters.match(/.{1,4}/g) ?? [characters];
  return `LUC-RDR-${segments.join("-")}`;
}

async function processRadarAdminRequest({
  supabaseUrl,
  supabaseServiceRoleKey,
  adminPassword,
  adminSessionSecret,
  requestMethod,
  requestUrl,
  headers,
  readBody,
}) {
  const pathname = getPathnameFromUrl(requestUrl);
  const signingSecret = adminSessionSecret || adminPassword;

  if (!pathname.startsWith("/api/admin/radar")) {
    return null;
  }

  if (!adminPassword || !signingSecret) {
    return {
      status: 500,
      payload: {
        error: "Configure RADAR_ADMIN_PASSWORD et RADAR_ADMIN_SESSION_SECRET cote serveur.",
      },
    };
  }

  if (pathname === "/api/admin/radar/session" && requestMethod === "GET") {
    const session = await readAdminSession(headers, signingSecret);

    if (!session) {
      return { status: 401, payload: { authenticated: false } };
    }

    return { status: 200, payload: { authenticated: true, expiresAt: session.exp } };
  }

  if (pathname === "/api/admin/radar/login" && requestMethod === "POST") {
    const parsedBody = parseJsonBody(await readBody());
    const submittedPassword = typeof parsedBody?.password === "string" ? parsedBody.password : "";

    if (submittedPassword !== adminPassword) {
      return { status: 401, payload: { error: "Mot de passe admin invalide." } };
    }

    const expiresAt = Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000;
    const sessionToken = await signAdminSession(signingSecret, {
      scope: "radar_admin",
      exp: expiresAt,
    });

    return {
      status: 200,
      payload: { authenticated: true, expiresAt },
      headers: {
        "Set-Cookie": buildAdminCookie(sessionToken, ADMIN_SESSION_TTL_SECONDS, requestUrl),
      },
    };
  }

  if (pathname === "/api/admin/radar/logout" && requestMethod === "POST") {
    return {
      status: 200,
      payload: { authenticated: false },
      headers: {
        "Set-Cookie": buildAdminCookie("", 0, requestUrl),
      },
    };
  }

  if (pathname === "/api/admin/radar/generate-code" && requestMethod === "POST") {
    const session = await readAdminSession(headers, signingSecret);

    if (!session) {
      return { status: 401, payload: { error: "Session admin invalide." } };
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return {
        status: 500,
        payload: { error: "Configure VITE_SUPABASE_URL ou SUPABASE_URL, puis SUPABASE_SERVICE_ROLE_KEY pour generer des codes." },
      };
    }

    const parsedBody = parseJsonBody(await readBody());
    const email = normalizeEmail(parsedBody?.email);
    const amountFcfa = Math.max(0, Math.trunc(Number(parsedBody?.amountFcfa ?? 0)));
    const tokenCount = Math.max(0, Math.trunc(Number(parsedBody?.tokenCount ?? 0)));
    const paymentMethod = typeof parsedBody?.paymentMethod === "string" ? parsedBody.paymentMethod : "";
    const offerLabel = normalizeSafeLabel(parsedBody?.offerLabel);

    if (!email || !email.includes("@")) {
      return { status: 400, payload: { error: "Email utilisateur invalide." } };
    }

    if (!allowedPaymentMethods.has(paymentMethod)) {
      return { status: 400, payload: { error: "Moyen de paiement invalide." } };
    }

    if (amountFcfa <= 0 || tokenCount <= 0) {
      return { status: 400, payload: { error: "Montant ou nombre de jetons invalide." } };
    }

    const plainCode = buildRandomRadarCode();
    const codeHash = await sha256Hex(plainCode.toUpperCase());
    const expiresAt = new Date(Date.now() + RADAR_CODE_EXPIRY_DAYS * 86400000).toISOString();
    const serviceClient = createServiceSupabaseClient(supabaseUrl, supabaseServiceRoleKey);
    const { error } = await serviceClient.from("radar_token_codes").insert({
      email,
      amount_fcfa: amountFcfa,
      token_count: tokenCount,
      payment_method: paymentMethod,
      offer_label: offerLabel || null,
      code_hash: codeHash,
      expires_at: expiresAt,
    });

    if (error) {
      return { status: 500, payload: { error: error.message } };
    }

    return {
      status: 200,
      payload: {
        code: plainCode,
        email,
        amountFcfa,
        tokenCount,
        paymentMethod,
        offerLabel: offerLabel || null,
        expiresAt,
      },
    };
  }

  return null;
}

export function createRadarAdminRequestHandler(options) {
  return async function handleRadarAdminRequest(request, response) {
    const result = await processRadarAdminRequest({
      ...options,
      requestMethod: request.method,
      requestUrl: request.url,
      headers: request.headers,
      readBody: () =>
        new Promise((resolve, reject) => {
          let body = "";

          request.on("data", (chunk) => {
            body += chunk.toString();
          });
          request.on("end", () => resolve(body));
          request.on("error", reject);
        }),
    });

    if (!result) {
      return false;
    }

    sendJson(response, result.status, result.payload, result.headers);
    return true;
  };
}

export async function handlePagesRadarAdminRequest(context, options) {
  const result = await processRadarAdminRequest({
    ...options,
    requestMethod: context.request.method,
    requestUrl: context.request.url,
    headers: context.request.headers,
    readBody: () => context.request.text(),
  });

  if (!result) {
    return typeof context.next === "function" ? context.next() : buildJsonResponse(404, { error: "Not found." });
  }

  return buildJsonResponse(result.status, result.payload, result.headers);
}
