import { createClient } from "@supabase/supabase-js";

const RADAR_WEEKLY_LIMIT = 2;
const MAX_RADAR_BODY_BYTES = 16 * 1024;
const MAX_RADAR_WINDOW_DAYS = 7;
const RADAR_PROVIDER_GROQ = "groq";
const RADAR_PROVIDER_ANTHROPIC = "anthropic";
const GROQ_RADAR_MODEL = "groq/compound";
const ANTHROPIC_RADAR_MODEL = "claude-sonnet-4-20250514";
const THESPORTSDB_BASE_URL = "https://www.thesportsdb.com/api/v1/json/123";
const MAX_STRUCTURED_RADAR_EVENTS = 4;
const MAX_COMPACT_STRUCTURED_RADAR_EVENTS = 3;
const MAX_ULTRA_COMPACT_STRUCTURED_RADAR_EVENTS = 2;
const MAX_ANTHROPIC_CONTINUATIONS = 3;
const MAX_ANTHROPIC_RATE_LIMIT_RETRIES = 1;
const MAX_ANTHROPIC_RATE_LIMIT_RETRY_MS = 3000;
const DEFAULT_ANTHROPIC_RATE_LIMIT_RETRY_MS = 1200;
const MAX_DISCIPLINE_RECENT_RESULTS = 10;
const MAX_RADAR_HISTORY_SUMMARY_CHARS = 140;
const MAX_PROVIDER_TRANSIENT_RETRIES = 1;
const PROVIDER_TRANSIENT_RETRY_DELAY_MS = 900;
const allowedRadarSports = new Set(["Football", "Basketball", "Tennis"]);
const allowedRadarRisks = new Set(["prudent", "balanced", "aggressive"]);
const RADAR_REQUEST_TOO_LARGE_ERROR = "RADAR_REQUEST_TOO_LARGE";
const RADAR_TRANSIENT_FAILURE_ERROR = "RADAR_TRANSIENT_FAILURE";

function getAppLanguage(value) {
  return value === "en" ? "en" : "fr";
}

function getRadarServerCopy(language = "fr") {
  return language === "en"
    ? {
        emptyResponse: "The Radar response is empty.",
        invalidJsonResponse: "The Radar response is not usable JSON.",
        requestTooLarge: "Radar had to compact the request because the context was too large.",
        busyNow: "Radar is busy right now. Try again in a few seconds.",
        invalidSession: "Your session is invalid. Sign in again.",
        serverSupabaseMissing: "Server Supabase configuration is missing to secure Radar.",
        applySchema: "Apply the full Supabase schema to enable Radar quotas and tokens.",
        verifyQuota: "Unable to check this week's Radar quota.",
        providerEnvMissing: "Add GROQ_API_KEY to your environment to enable Radar.",
        invalidJson: "Invalid JSON.",
        missingStats: "Stats are required to analyze discipline.",
        missingInputs: "Sport, risk, or dates are missing.",
        unsupportedSport: "Unsupported sport.",
        invalidRisk: "Invalid risk level.",
        invalidWindow: "Invalid date window.",
        windowTooWide: `Date window is too wide. Maximum ${MAX_RADAR_WINDOW_DAYS} days.`,
        pastWindow: (todayIso) => `This date window is already in the past. Choose a date from ${todayIso}.`,
        quotaReached: "This week's quota has been reached. Get tokens to continue.",
        historyWeak: "History: light.",
        noPlausiblePeriod: "No plausible event was found in the requested window.",
        noPlausiblePeriodAndNext: "No plausible event was found in the requested period or in the nearby fallback window.",
        shiftedSingle: (requestedStartDate, requestedEndDate, nextStartDate) =>
          `No plausible event between ${requestedStartDate} and ${requestedEndDate}. Radar shifted to ${nextStartDate}.`,
        shiftedRange: (requestedStartDate, requestedEndDate, nextStartDate, nextEndDate) =>
          `No plausible event between ${requestedStartDate} and ${requestedEndDate}. Radar shifted to a nearby window from ${nextStartDate} to ${nextEndDate}.`,
        compactUltra: [
          "0 to 2 plausible suggestions.",
          "1 to 2 legs maximum.",
          "No leg outside the window or before today.",
          "If in doubt, exclude the event.",
          "Strict JSON only.",
        ].join(" "),
        compactStandard: [
          "0 to 3 plausible suggestions.",
          "1 to 3 legs maximum.",
          "No leg outside the window or before today.",
          "If in doubt, exclude the event.",
          "Prefer a solid single over a forced combo.",
          "Strict JSON only.",
        ].join(" "),
        structuredEmptyUltra: "No usable structured fixture. If doubt remains about upcoming matches, return suggestions: [].",
        structuredEmpty: "No usable structured fixture was found in the window; you may then rely on web search.",
        structuredHeader: "Structured fixtures already verified in the window.",
        structuredPriority: "Absolute priority to these matchups before any other research.",
        labelFallback: "Angle",
        cautionFallback: "Watch lineups, rotation, or context before confirming.",
        disciplineInvalid: "The discipline response is not usable.",
        requestTooLargeBody: "Request body is too large.",
        analysisUnavailable: "Radar analysis is unavailable right now.",
        scheduleRequestFailed: "Structured sports schedule request failed.",
        requestFailed: "Radar request failed.",
        analysisRetry: "Radar could not finish this analysis this time. Try again in a few seconds.",
        noResponseLeakFallback: "Radar is unavailable right now.",
      }
    : {
        emptyResponse: "La reponse Radar est vide.",
        invalidJsonResponse: "La reponse Radar n'est pas un JSON exploitable.",
        requestTooLarge: "Radar a du compacter la requete car le contexte etait trop lourd.",
        busyNow: "Radar est occupe pour le moment. Relance dans quelques secondes.",
        invalidSession: "Session invalide. Reconnecte-toi.",
        serverSupabaseMissing: "Supabase serveur manquant pour securiser Radar.",
        applySchema: "Applique le schema Supabase complet pour activer les quotas et jetons Radar.",
        verifyQuota: "Impossible de verifier le quota Radar de la semaine.",
        providerEnvMissing: "Ajoute GROQ_API_KEY dans ton .env pour activer Radar.",
        invalidJson: "JSON invalide.",
        missingStats: "Statistiques manquantes pour analyser la discipline.",
        missingInputs: "Sport, risque ou dates manquants.",
        unsupportedSport: "Sport non pris en charge.",
        invalidRisk: "Niveau de risque invalide.",
        invalidWindow: "Fenetre de dates invalide.",
        windowTooWide: `Fenetre trop large. Maximum ${MAX_RADAR_WINDOW_DAYS} jours.`,
        pastWindow: (todayIso) => `La fenetre demandee est deja passee. Choisis une date a partir du ${todayIso}.`,
        quotaReached: "Quota de la semaine atteint. Obtiens des jetons pour continuer.",
        historyWeak: "Historique: faible.",
        noPlausiblePeriod: "Aucun evenement plausible sur la periode demandee.",
        noPlausiblePeriodAndNext: "Aucun evenement plausible sur la periode demandee ni sur la courte fenetre suivante.",
        shiftedSingle: (requestedStartDate, requestedEndDate, nextStartDate) =>
          `Aucun evenement plausible entre ${requestedStartDate} et ${requestedEndDate}. Radar a glisse vers le ${nextStartDate}.`,
        shiftedRange: (requestedStartDate, requestedEndDate, nextStartDate, nextEndDate) =>
          `Aucun evenement plausible entre ${requestedStartDate} et ${requestedEndDate}. Radar a glisse vers une fenetre proche, du ${nextStartDate} au ${nextEndDate}.`,
        compactUltra: [
          "0 a 2 suggestions plausibles.",
          "1 a 2 selections maximum.",
          "Aucune selection hors fenetre ni avant aujourd'hui.",
          "Si doute, exclue l'evenement.",
          "JSON strict uniquement.",
        ].join(" "),
        compactStandard: [
          "0 a 3 suggestions plausibles.",
          "1 a 3 selections maximum.",
          "Aucune selection hors fenetre ni avant aujourd'hui.",
          "Si doute, exclue l'evenement.",
          "Prefere un single solide a un combine force.",
          "JSON strict uniquement.",
        ].join(" "),
        structuredEmptyUltra: "Aucune fixture structuree exploitable. Si un doute subsiste sur les matchs a venir, retourne suggestions: [].",
        structuredEmpty: "Aucune fixture structuree exploitable n'a ete trouvee dans la fenetre; tu peux alors t'appuyer sur la recherche web.",
        structuredHeader: "Fixtures structurees deja verifiees dans la fenetre.",
        structuredPriority: "Priorite absolue a ces affiches avant toute autre recherche.",
        labelFallback: "Angle",
        cautionFallback: "Vigilance sur compos, rotation ou contexte avant validation.",
        disciplineInvalid: "La reponse discipline n'est pas exploitable.",
        requestTooLargeBody: "Requete trop volumineuse.",
        analysisUnavailable: "Analyse Radar indisponible pour le moment.",
        scheduleRequestFailed: "Structured sports schedule request failed.",
        requestFailed: "La requête Radar a échoué.",
        analysisRetry: "Radar n'a pas pu finaliser cette analyse cette fois. Relance dans quelques secondes.",
        noResponseLeakFallback: "Analyse Radar indisponible pour le moment.",
      };
}

function buildRadarSystemPrompt(language = "fr") {
  return language === "en"
    ? [
        "You are a rigorous, factual betting analyst.",
        "You only propose real, upcoming, verifiable events.",
        "You never invent a date, competition, event, market, pick, or odds.",
        "If any doubt exists about an event's existence, date, or status, exclude it.",
        "A solid single is better than a forced combo. Maximum 3 legs per suggestion.",
        "Prefer defensible markets over popular picks.",
        "Reply only with raw JSON, without markdown or surrounding text.",
      ].join(" ")
    : [
        "Tu es un analyste de paris rigoureux et factuel.",
        "Tu ne proposes que des evenements reels, a venir et verifiables.",
        "Tu n'inventes jamais date, competition, event, marche, pick ou cote.",
        "Si un doute existe sur l'existence, la date ou le statut d'un evenement, tu l'exclus.",
        "Un single solide vaut mieux qu'un combine force. Maximum 3 selections par suggestion.",
        "Tu privilegies les marches defendables plutot que les choix populaires.",
        "Tu reponds uniquement en JSON brut, sans markdown ni texte autour.",
      ].join(" ");
}

function buildDisciplineSystemPrompt(language = "fr") {
  return language === "en"
    ? [
        "You are a sports-betting discipline coach: cold, lucid, and useful.",
        "You analyze only the provided stats and trends. You invent nothing.",
        "You do not give match picks, odds angles, or event predictions.",
        "Your goal is to point out strengths, discipline risks, and concrete bankroll and behavior routines.",
        "Watch mainly for: stake inflation, chasing losses, overexposure, excessive combos, inconsistency, overconfidence, and poor volume control.",
        "Reply only with strict JSON: {summary:string,strengths:string[],warnings:string[],actions:string[]}.",
        "summary = 1 to 2 sentences. strengths = 2 to 3 max. warnings = 2 to 4 max. actions = 3 to 5 max.",
        "Every point must be short, concrete, natural English, and actionable this week.",
      ].join(" ")
    : [
        "Tu es un coach de discipline de paris sportifs, froid, lucide et utile.",
        "Tu analyses uniquement les statistiques et tendances fournies. Tu n'inventes rien.",
        "Tu ne donnes aucun prono de match, aucun angle de cote, aucune prediction evenementielle.",
        "Ton but: pointer les forces, les risques de discipline, et proposer des routines concretes de bankroll et de comportement.",
        "Tu surveilles surtout: hausse des mises, chasse aux pertes, surexposition, exces de combines, irregularite, surconfiance et mauvaise gestion du volume.",
        "Tu reponds uniquement en JSON strict: {summary:string,strengths:string[],warnings:string[],actions:string[]}.",
        "summary = 1 a 2 phrases. strengths = 2 a 3 points max. warnings = 2 a 4 points max. actions = 3 a 5 points max.",
        "Chaque point doit etre court, concret, en francais naturel, actionnable cette semaine.",
      ].join(" ");
}

const anthropicRadarTools = [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }];

const genericEventPatterns = [
  /^match\b/i,
  /^rencontre\b/i,
  /^affiche\b/i,
  /\bequipe\b/i,
  /\bfavorite\b/i,
  /\boutsider\b/i,
  /\bdomicile\b/i,
  /\bexterieur\b/i,
  /\bvisiteur\b/i,
  /\brecevant\b/i,
  /\bmatch allemand\b/i,
  /\bmatch europeen\b/i,
  /\bcompetition\b/i,
];
const genericCompetitionPatterns = [
  /^match\b/i,
  /^competition\b/i,
  /^championnat\b$/i,
  /^coupe\b$/i,
  /^ligue\b$/i,
  /^tournoi\b$/i,
  /^competition europeenne$/i,
  /^competition continentale$/i,
  /^championnat national$/i,
  /^tournoi atp$/i,
  /^tournoi wta$/i,
];
const genericSidePatterns = [
  /^equipe\b/i,
  /^club\b/i,
  /^joueur\b/i,
  /^favorite\b/i,
  /^outsider\b/i,
  /^domicile$/i,
  /^exterieur$/i,
  /^visiteur$/i,
  /^recevant$/i,
  /^local$/i,
  /^adverse$/i,
];
const genericMarketPatterns = [/^selection$/i, /^pari$/i, /^pick$/i, /^choix$/i, /^marche$/i, /^prediction$/i];
const genericPickPatterns = [/^selection$/i, /^pari$/i, /^pick$/i, /^choix$/i, /^a definir$/i, /^a confirmer$/i];
const NO_USABLE_SUGGESTIONS_ERROR = "RADAR_NO_USABLE_SUGGESTIONS";
const doualaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Douala",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function buildJsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getErrorStatusCode(error) {
  return typeof error?.statusCode === "number" ? error.statusCode : 500;
}

function getDoualaIsoDate(date = new Date()) {
  return doualaDateFormatter.format(date);
}

function getDoualaDateParts(date = new Date()) {
  const parts = doualaDateFormatter.formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? "0"),
    month: Number(parts.find((part) => part.type === "month")?.value ?? "0"),
    day: Number(parts.find((part) => part.type === "day")?.value ?? "0"),
  };
}

function formatUtcDateToIso(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDoualaWeekStartIsoDate(date = new Date()) {
  const { year, month, day } = getDoualaDateParts(date);
  const weekDate = new Date(Date.UTC(year, month - 1, day));
  const weekday = weekDate.getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;

  weekDate.setUTCDate(weekDate.getUTCDate() - daysSinceMonday);
  return formatUtcDateToIso(weekDate);
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function parseRetryAfterSeconds(value) {
  if (!value) {
    return null;
  }

  const trimmedValue = String(value).trim();
  const parsedSeconds = Number.parseInt(trimmedValue, 10);

  if (Number.isFinite(parsedSeconds) && parsedSeconds >= 0) {
    return parsedSeconds;
  }

  const parsedDate = Date.parse(trimmedValue);

  if (!Number.isFinite(parsedDate)) {
    return null;
  }

  return Math.max(0, Math.ceil((parsedDate - Date.now()) / 1000));
}

function toIsoDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToIsoDate(value, days) {
  const nextDate = new Date(`${value}T12:00:00`);
  nextDate.setDate(nextDate.getDate() + days);
  return toIsoDateString(nextDate);
}

function countDaysInWindow(startDate, endDate) {
  const start = new Date(`${startDate}T12:00:00`).getTime();
  const end = new Date(`${endDate}T12:00:00`).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return Number.NaN;
  }

  return Math.floor((end - start) / 86400000) + 1;
}

function stripJsonCodeFence(value) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function tryParseJson(value) {
  try {
    return JSON.parse(stripJsonCodeFence(value));
  } catch {
    return null;
  }
}

function findBalancedJson(value) {
  const input = stripJsonCodeFence(value);

  for (let startIndex = 0; startIndex < input.length; startIndex += 1) {
    const firstChar = input[startIndex];

    if (firstChar !== "{" && firstChar !== "[") {
      continue;
    }

    const stack = [firstChar];
    let inString = false;
    let escaped = false;

    for (let index = startIndex + 1; index < input.length; index += 1) {
      const currentChar = input[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (currentChar === "\\") {
          escaped = true;
        } else if (currentChar === '"') {
          inString = false;
        }

        continue;
      }

      if (currentChar === '"') {
        inString = true;
        continue;
      }

      if (currentChar === "{" || currentChar === "[") {
        stack.push(currentChar);
        continue;
      }

      if (currentChar !== "}" && currentChar !== "]") {
        continue;
      }

      const lastOpened = stack[stack.length - 1];
      const closesObject = currentChar === "}" && lastOpened === "{";
      const closesArray = currentChar === "]" && lastOpened === "[";

      if (!(closesObject || closesArray)) {
        break;
      }

      stack.pop();

      if (stack.length === 0) {
        return input.slice(startIndex, index + 1);
      }
    }
  }

  return "";
}

function extractRadarJsonPayload(payload, language = "fr") {
  const copy = getRadarServerCopy(language);

  if (!Array.isArray(payload?.content)) {
    throw new Error(copy.emptyResponse);
  }

  const textBlocks = payload.content
    .filter((block) => block?.type === "text" && typeof block?.text === "string")
    .map((block) => block.text.trim())
    .filter(Boolean);

  for (let index = textBlocks.length - 1; index >= 0; index -= 1) {
    const parsed = tryParseJson(textBlocks[index]);

    if (parsed !== null) {
      return parsed;
    }

    const extractedJson = findBalancedJson(textBlocks[index]);
    const extractedParsed = extractedJson ? tryParseJson(extractedJson) : null;

    if (extractedParsed !== null) {
      return extractedParsed;
    }
  }

  const combinedText = textBlocks.join("\n");
  const combinedParsed = tryParseJson(combinedText);

  if (combinedParsed !== null) {
    return combinedParsed;
  }

  const extractedJson = findBalancedJson(combinedText);
  const extractedParsed = extractedJson ? tryParseJson(extractedJson) : null;

  if (extractedParsed !== null) {
    return extractedParsed;
  }

  throw new Error(copy.invalidJsonResponse);
}

function readDateField(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : "";
}

function createNoUsableSuggestionsError() {
  return new Error(NO_USABLE_SUGGESTIONS_ERROR);
}

function isNoUsableSuggestionsError(error) {
  return error instanceof Error && error.message === NO_USABLE_SUGGESTIONS_ERROR;
}

function createRequestTooLargeError(language = "fr") {
  const error = new Error(getRadarServerCopy(language).requestTooLarge);
  error.code = RADAR_REQUEST_TOO_LARGE_ERROR;
  error.statusCode = 413;
  return error;
}

function isRequestTooLargeError(error) {
  return error instanceof Error && error.code === RADAR_REQUEST_TOO_LARGE_ERROR;
}

function createTransientRadarError(message, language = "fr") {
  const error = new Error(message || getRadarServerCopy(language).busyNow);
  error.code = RADAR_TRANSIENT_FAILURE_ERROR;
  error.statusCode = 503;
  return error;
}

function isTransientRadarError(error) {
  return error instanceof Error && error.code === RADAR_TRANSIENT_FAILURE_ERROR;
}

function isRequestTooLargeMessage(message) {
  const normalized = normalizeFreeText(message).toLowerCase();

  return (
    normalized.includes("request entity too large") ||
    normalized.includes("payload too large") ||
    normalized.includes("context length") ||
    normalized.includes("prompt is too long") ||
    normalized.includes("input too large") ||
    normalized.includes("message too long") ||
    normalized.includes("too many tokens")
  );
}

function isRetriableProviderStatus(status) {
  return status === 408 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504 || status === 529;
}

function isTransientProviderMessage(message) {
  const normalized = normalizeFreeText(message).toLowerCase();

  return (
    normalized.includes("service unavailable") ||
    normalized.includes("temporarily unavailable") ||
    normalized.includes("upstream") ||
    normalized.includes("gateway") ||
    normalized.includes("overloaded") ||
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("timeout") ||
    normalized.includes("timed out")
  );
}

function buildShiftNote(requestedStartDate, requestedEndDate, nextStartDate, nextEndDate, language = "fr") {
  const copy = getRadarServerCopy(language);

  if (nextStartDate === nextEndDate) {
    return copy.shiftedSingle(requestedStartDate, requestedEndDate, nextStartDate);
  }

  return copy.shiftedRange(requestedStartDate, requestedEndDate, nextStartDate, nextEndDate);
}

function buildRadarAttempts(requestedStartDate, requestedEndDate, language = "fr") {
  return Array.from({ length: 3 }, (_, index) => {
    const offset = index;
    const startDate = addDaysToIsoDate(requestedStartDate, offset);
    const endDate = addDaysToIsoDate(requestedEndDate, offset);

    return {
      startDate,
      endDate,
      shifted: offset > 0,
      note: offset > 0 ? buildShiftNote(requestedStartDate, requestedEndDate, startDate, endDate, language) : "",
    };
  });
}

function buildCompactInstructionSet(promptProfile = "compact", language = "fr") {
  const copy = getRadarServerCopy(language);

  if (promptProfile === "ultra") {
    return copy.compactUltra;
  }

  return copy.compactStandard;
}

function normalizeFreeText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function matchesAnyPattern(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

function splitEventSides(event) {
  const separators = [/\s+vs\.?\s+/i, /\s+v\.?\s+/i, /\s+contre\s+/i, /\s+@\s+/i, /\s+-\s+/, /\s+–\s+/];

  for (const separator of separators) {
    const parts = event.split(separator).map((entry) => entry.trim()).filter(Boolean);

    if (parts.length === 2) {
      return parts;
    }
  }

  return null;
}

function isExplicitCompetition(value) {
  return Boolean(value) && value.length >= 4 && !matchesAnyPattern(value, genericCompetitionPatterns);
}

function isExplicitEvent(value) {
  if (!value || value.length < 7 || matchesAnyPattern(value, genericEventPatterns)) {
    return false;
  }

  const sides = splitEventSides(value);

  if (!sides) {
    return false;
  }

  return sides.every((side) => side.length >= 2 && /[A-Za-zÀ-ÿ]/.test(side) && !matchesAnyPattern(side, genericSidePatterns));
}

function isConcreteMarket(value) {
  return Boolean(value) && value.length >= 3 && !matchesAnyPattern(value, genericMarketPatterns);
}

function isConcretePick(value, event) {
  return Boolean(value) && value.length >= 1 && value !== event && !matchesAnyPattern(value, genericPickPatterns);
}

function isDateWithinWindow(value, startDate, endDate) {
  return value >= startDate && value <= endDate;
}

function normalizeRadarLeg(entry, allowedStartDate, allowedEndDate, todayIso) {
  const competition = normalizeFreeText(entry?.competition);
  const event = normalizeFreeText(entry?.event);
  const eventDate = readDateField(entry?.event_date) || readDateField(entry?.eventDate) || readDateField(entry?.date);
  const market = normalizeFreeText(entry?.market);
  const pick = normalizeFreeText(entry?.pick);

  if (!competition || !event || !eventDate || !market || !pick) {
    return null;
  }

  if (!isExplicitCompetition(competition) || !isExplicitEvent(event) || !isConcreteMarket(market) || !isConcretePick(pick, event)) {
    return null;
  }

  if (!isDateWithinWindow(eventDate, allowedStartDate, allowedEndDate) || eventDate < todayIso) {
    return null;
  }

  return {
    competition,
    event,
    eventDate,
    market,
    pick,
  };
}

function readRadarWindowFromPayload(payload) {
  const startDate =
    readDateField(payload?.used_window?.start_date) ||
    readDateField(payload?.used_window?.startDate) ||
    readDateField(payload?.window?.start_date) ||
    readDateField(payload?.window?.startDate);
  const endDate =
    readDateField(payload?.used_window?.end_date) ||
    readDateField(payload?.used_window?.endDate) ||
    readDateField(payload?.window?.end_date) ||
    readDateField(payload?.window?.endDate);

  if (!startDate || !endDate || endDate < startDate) {
    return null;
  }

  return { startDate, endDate };
}

function buildExplicitNoSuggestionsResult(parsed, requestedStartDate, requestedEndDate, fallbackWindow, usage, language = "fr") {
  const copy = getRadarServerCopy(language);

  if (Array.isArray(parsed) || !Array.isArray(parsed?.suggestions) || parsed.suggestions.length > 0) {
    return null;
  }

  const payloadWindow = readRadarWindowFromPayload(parsed);
  const startDate = payloadWindow?.startDate ?? fallbackWindow?.startDate ?? requestedStartDate;
  const endDate = payloadWindow?.endDate ?? fallbackWindow?.endDate ?? requestedEndDate;
  const note =
    normalizeFreeText(parsed?.note) ||
    fallbackWindow?.note ||
    copy.noPlausiblePeriod;
  const shifted =
    (typeof parsed?.shifted === "boolean" ? parsed.shifted : false) ||
    Boolean(fallbackWindow) ||
    startDate !== requestedStartDate ||
    endDate !== requestedEndDate;

  return {
    suggestions: [],
    window: {
      startDate,
      endDate,
      shifted,
      note,
    },
    usage,
  };
}

function normalizeRadarResult(parsed, requestedStartDate, requestedEndDate, todayIso, fallbackWindow, usage, language = "fr") {
  const copy = getRadarServerCopy(language);
  const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
  const seenSuggestionSignatures = new Set();

  const suggestions = items
    .map((item) => {
      const label = typeof item?.label === "string" ? item.label.trim() : "";
      const legs = Array.isArray(item?.legs)
        ? item.legs
            .map((entry) => normalizeRadarLeg(entry, requestedStartDate, requestedEndDate, todayIso))
            .filter(Boolean)
            .slice(0, 3)
        : [];
      const oddsValue =
        typeof item?.odds === "number"
          ? item.odds.toFixed(2)
          : typeof item?.odds === "string"
            ? item.odds.trim()
            : "";
      const rationale = typeof item?.rationale === "string" ? item.rationale.trim() : "";
      const caution =
        typeof item?.caution === "string"
          ? item.caution.trim()
          : copy.cautionFallback;
      const uniqueLegs = legs.filter((leg, index) => {
        const signature = `${leg.competition}|${leg.event}|${leg.eventDate}|${leg.market}|${leg.pick}`;
        return legs.findIndex((entry) => {
          return `${entry.competition}|${entry.event}|${entry.eventDate}|${entry.market}|${entry.pick}` === signature;
        }) === index;
      });

      if (uniqueLegs.length < 1 || !oddsValue || !rationale) {
        return null;
      }

      const suggestionSignature = uniqueLegs
        .map((leg) => `${leg.competition}|${leg.event}|${leg.eventDate}|${leg.pick}`)
        .sort()
        .join("||");

      if (seenSuggestionSignatures.has(suggestionSignature)) {
        return null;
      }

      seenSuggestionSignatures.add(suggestionSignature);

      return {
        label: label || copy.labelFallback,
        legs: uniqueLegs,
        odds: oddsValue,
        rationale,
        caution,
      };
    })
    .filter(Boolean)
    .slice(0, 3);

  if (!suggestions.length) {
    const explicitNoSuggestionsResult = buildExplicitNoSuggestionsResult(
      parsed,
      requestedStartDate,
      requestedEndDate,
      fallbackWindow,
      usage,
      language,
    );

    if (explicitNoSuggestionsResult) {
      return explicitNoSuggestionsResult;
    }

    throw createNoUsableSuggestionsError();
  }

  return {
    suggestions,
    window: fallbackWindow
      ? {
          startDate: fallbackWindow.startDate,
          endDate: fallbackWindow.endDate,
          shifted: true,
          note: fallbackWindow.note,
        }
      : {
          startDate: requestedStartDate,
          endDate: requestedEndDate,
          shifted: false,
          note: "",
        },
    usage,
  };
}

function isIsoDateInput(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function getMarketGuideForSport(sport, language = "fr") {
  if (sport === "Football") {
    return language === "en"
      ? "Preferred markets: double chance, draw no bet, handicap, totals, BTTS when justified."
      : "Marches privilegies: double chance, draw no bet, handicap, totals, BTTS si justifie.";
  }

  if (sport === "Basketball") {
    return language === "en"
      ? "Preferred markets: spread, game total, team total, first half."
      : "Marches privilegies: spread, total match, team total, 1re mi-temps.";
  }

  if (sport === "Tennis") {
    return language === "en"
      ? "Preferred markets: match winner, games handicap, sets handicap, total games, first set."
      : "Marches privilegies: vainqueur, handicap jeux, handicap sets, total jeux, 1er set.";
  }

  return language === "en" ? "Choose the most defensible market." : "Choisis le marche le plus defendable.";
}

function getRiskGuideForRadar(risk, language = "fr") {
  if (risk === "prudent") {
    return language === "en"
      ? "Careful profile: low variance, sensible lines, limited correlation."
      : "Profil prudent: variance basse, lignes sages, peu de correlation.";
  }

  if (risk === "aggressive") {
    return language === "en"
      ? "Aggressive profile: stronger angles are allowed, but never speculative."
      : "Profil agressif: angles plus forts possibles, mais jamais speculatifs.";
  }

  return language === "en"
    ? "Balanced profile: mix of solid markets and defensible secondary angles."
    : "Profil equilibre: mix de marches solides et angles secondaires defensables.";
}

function getSearchFocusForSport(sport, language = "fr") {
  if (sport === "Football") {
    return language === "en"
      ? "Prioritize reliable public schedules from major leagues and cups."
      : "Priorite aux calendriers publics fiables des ligues et coupes majeures.";
  }

  if (sport === "Basketball") {
    return language === "en"
      ? "Prioritize public NBA, EuroLeague, and clearly scheduled competitions."
      : "Priorite aux calendriers publics NBA, EuroLeague et competitions claires.";
  }

  if (sport === "Tennis") {
    return language === "en"
      ? "Prioritize ATP, WTA, Challenger, and ITF matches with reliable order of play."
      : "Priorite aux matchs ATP, WTA, Challenger et ITF avec ordre de jeu fiable.";
  }

  return language === "en"
    ? "Prioritize competitions with reliable scheduling."
    : "Priorite aux competitions avec calendrier fiable.";
}

function getStructuredSportName(sport) {
  if (sport === "Football") {
    return "Soccer";
  }

  if (sport === "Basketball") {
    return "Basketball";
  }

  if (sport === "Tennis") {
    return "Tennis";
  }

  return sport;
}

function isFinishedStructuredEvent(event, todayIso) {
  const status = normalizeFreeText(event?.strStatus).toLowerCase();
  const eventDate = readDateField(event?.dateEventLocal) || readDateField(event?.dateEvent) || "";

  if (!eventDate) {
    return true;
  }

  if (eventDate < todayIso) {
    return true;
  }

  if (
    status.includes("ft") ||
    status.includes("finished") ||
    status.includes("match finished") ||
    status.includes("after extra") ||
    status.includes("aot") ||
    status.includes("cancel") ||
    status.includes("abandon") ||
    status.includes("walkover")
  ) {
    return true;
  }

  return false;
}

function normalizeStructuredRadarEvent(event) {
  const competition = normalizeFreeText(event?.strLeague);
  const eventLabel = normalizeFreeText(event?.strEvent);
  const eventDate = readDateField(event?.dateEventLocal) || readDateField(event?.dateEvent);

  if (!competition || !eventLabel || !eventDate) {
    return null;
  }

  return {
    competition,
    event: eventLabel,
    event_date: eventDate,
  };
}

async function fetchStructuredRadarEventsForDay(sport, date) {
  const structuredSportName = encodeURIComponent(getStructuredSportName(sport));
  const url = `${THESPORTSDB_BASE_URL}/eventsday.php?d=${encodeURIComponent(date)}&s=${structuredSportName}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Structured sports schedule request failed.");
  }

  const payload = await response.json().catch(() => null);
  return Array.isArray(payload?.events) ? payload.events : [];
}

async function fetchStructuredRadarEventsForWindow(sport, startDate, endDate, todayIso) {
  const requestedDayCount = countDaysInWindow(startDate, endDate);

  if (!Number.isFinite(requestedDayCount) || requestedDayCount < 1) {
    return [];
  }

  const eventsBySignature = new Map();

  for (let dayOffset = 0; dayOffset < requestedDayCount; dayOffset += 1) {
    const currentDay = addDaysToIsoDate(startDate, dayOffset);
    const events = await fetchStructuredRadarEventsForDay(sport, currentDay).catch(() => []);

    for (const event of events) {
      if (isFinishedStructuredEvent(event, todayIso)) {
        continue;
      }

      const normalizedEvent = normalizeStructuredRadarEvent(event);

      if (!normalizedEvent) {
        continue;
      }

      const signature = `${normalizedEvent.competition}|${normalizedEvent.event}|${normalizedEvent.event_date}`;

      if (!eventsBySignature.has(signature)) {
        eventsBySignature.set(signature, normalizedEvent);
      }
    }
  }

  return Array.from(eventsBySignature.values()).slice(0, MAX_STRUCTURED_RADAR_EVENTS);
}

function buildStructuredEventsPrompt(events, promptProfile = "full", language = "fr") {
  const copy = getRadarServerCopy(language);

  if (!Array.isArray(events) || !events.length) {
    if (promptProfile === "ultra") {
      return copy.structuredEmptyUltra;
    }

    return copy.structuredEmpty;
  }

  const maxEvents =
    promptProfile === "ultra"
      ? MAX_ULTRA_COMPACT_STRUCTURED_RADAR_EVENTS
      : promptProfile === "compact"
        ? MAX_COMPACT_STRUCTURED_RADAR_EVENTS
        : MAX_STRUCTURED_RADAR_EVENTS;
  const limitedEvents = events.slice(0, maxEvents);
  const summarizedEvents = limitedEvents
    .map((event, index) => `${index + 1}. ${event.event_date} | ${event.competition} | ${event.event}`)
    .join(" ; ");

  return [
    copy.structuredHeader,
    copy.structuredPriority,
    summarizedEvents,
  ].join(" ");
}

function buildRadarUserPrompt({
  sport,
  risk,
  todayIso,
  historyContext,
  marketGuide,
  riskGuide,
  searchFocus,
  attempt,
  structuredEventsPrompt,
  promptProfile = "full",
  language = "fr",
}) {
  const isCompact = promptProfile !== "full";
  const isUltraCompact = promptProfile === "ultra";
  const contextBlocks = isUltraCompact
    ? [structuredEventsPrompt]
    : isCompact
      ? [historyContext, riskGuide, structuredEventsPrompt]
      : [historyContext, marketGuide, riskGuide, searchFocus, structuredEventsPrompt];

  const baseInstructions = [
    language === "en" ? `Sport: ${sport}.` : `Sport: ${sport}.`,
    language === "en" ? `Risk: ${risk}.` : `Risque: ${risk}.`,
    language === "en" ? `Today's reference date: ${todayIso}.` : `Date de reference aujourd'hui: ${todayIso}.`,
    attempt.startDate === attempt.endDate
      ? language === "en"
        ? `Requested window: ${attempt.startDate}.`
        : `Fenetre souhaitee: ${attempt.startDate}.`
      : language === "en"
        ? `Requested window: from ${attempt.startDate} to ${attempt.endDate}.`
        : `Fenetre souhaitee: du ${attempt.startDate} au ${attempt.endDate}.`,
    attempt.shifted
      ? language === "en"
        ? `Automatic fallback window allowed: from ${attempt.startDate} to ${attempt.endDate}. Clearly state this shift.`
        : `Fenetre de repli automatique autorisee: du ${attempt.startDate} au ${attempt.endDate}. Signale clairement ce decalage.`
      : language === "en"
        ? "Stay primarily inside the requested window."
        : "Reste prioritairement dans la fenetre demandee.",
    ...contextBlocks,
    language === "en"
      ? `No pick may have an event_date outside ${attempt.startDate} -> ${attempt.endDate} or before ${todayIso}.`
      : `Aucune selection ne doit avoir un event_date hors de ${attempt.startDate} -> ${attempt.endDate} ni avant ${todayIso}.`,
    language === "en"
      ? "Each leg must contain competition, event, event_date, market, and pick."
      : "Chaque leg doit contenir competition, event, event_date, market et pick.",
    language === "en"
      ? "event = only the two teams or players."
      : "event = les deux equipes ou joueurs seulement.",
    language === "en"
      ? "label, market, pick, rationale, caution, and note must all be in natural English."
      : "label, market, pick, rationale, caution et note en francais.",
    language === "en" ? "Never write an exact kickoff time." : "N'ecris jamais d'heure exacte.",
    language === "en"
      ? "Strict JSON format: {used_window:{start_date,end_date}, shifted:boolean, note:string, suggestions:[{label, legs:[{competition,event,event_date,market,pick}], odds, rationale, caution}]}"
      : "Format JSON strict: {used_window:{start_date,end_date}, shifted:boolean, note:string, suggestions:[{label, legs:[{competition,event,event_date,market,pick}], odds, rationale, caution}]}",
  ];

  if (isCompact) {
    return [...baseInstructions, buildCompactInstructionSet(promptProfile, language)].join(" ");
  }

  return [
    ...baseInstructions,
    ...(language === "en"
      ? [
          "You may return 0 to 4 realistic suggestions with 1 to 3 legs maximum per suggestion.",
          "Never mention a match already played, a historical final, or a finished tournament.",
          "Cup and tournament competitions count fully: do not limit yourself to national leagues.",
          "If you are not sure an event is upcoming inside the requested window, exclude it instead of guessing.",
          "If no plausible event exists in the requested window, you may shift to the next useful window, at most 3 days after the requested end.",
          "For an event happening today, also verify that it is still upcoming; if time or status is doubtful, exclude it.",
          "If an event date is not clearly verified, exclude it.",
          "Diversify markets across suggestions when plausible.",
          "Avoid reusing the same matchup unless it is truly unavoidable.",
          "Do not overuse straight winners, moneylines, or generic overs if a better market exists on the same event.",
          "Use secondary but mainstream markets when they provide a smarter option than the most obvious public pick.",
          "If at least one confirmed match exists in the window, even only an ATP, WTA, or Challenger tournament, provide at least one suggestion from it.",
          "If only one or two solid events exist, still provide a single or short suggestion rather than suggestions: [].",
          "If you cannot produce a plausible suggestion without hallucinating, return suggestions: [].",
          "For each suggestion, return a short readable label, the legs, estimated odds, a concise rationale in natural English, and a concise caution in natural English.",
          "The response must be a single raw JSON object, without markdown and without any intro or closing sentence.",
          "If the window is shifted, you must state it clearly in note and used_window.",
        ]
      : [
          "Tu peux retourner de 0 a 4 suggestions realistes avec 1 a 3 selections maximum par suggestion.",
          "Ne cite jamais un match deja joue, une finale historique ou un tournoi termine.",
          "Une competition de coupe ou de tournoi compte pleinement: tu ne te limites jamais aux ligues nationales.",
          "Si tu n'es pas sur qu'un evenement est a venir dans la fenetre demandee, tu l'exclus au lieu de deviner.",
          "Si aucun evenement plausible n'existe dans la fenetre demandee, tu peux te decaler vers la prochaine fenetre utile, au maximum 3 jours apres la fin demandee.",
          "Pour un evenement qui tombe aujourd'hui, verifie aussi qu'il est encore a venir; s'il y a un doute sur l'horaire ou le statut, exclue-le.",
          "Si la date d'un evenement n'est pas clairement verifiee, exclue cet evenement.",
          "Diversifie les marches sur les suggestions quand c'est plausible.",
          "Evite de reutiliser les memes affiches sauf si c'est vraiment incontournable.",
          "N'abuse pas des vainqueurs secs, des moneylines ou des overs generiques si un meilleur marche existe sur le meme evenement.",
          "Utilise des marches secondaires mais mainstream lorsqu'ils offrent une option plus judicieuse que le choix public le plus evident.",
          "Si au moins un match confirme existe dans la fenetre, meme s'il s'agit seulement d'un tournoi ATP, WTA ou Challenger, propose au moins une suggestion a partir de lui.",
          "Si seuls un ou deux evenements solides existent, propose quand meme un single ou une suggestion courte plutot que suggestions: [].",
          "Si tu ne peux pas produire une suggestion plausible sans halluciner, retourne suggestions: [].",
          "Pour chaque suggestion, retourne un label court et lisible en francais, les selections, la cote estimee, une rationale concise en francais et une vigilance concise en francais.",
          "La reponse doit etre un seul objet JSON brut, sans balise markdown et sans phrase d'introduction ou de conclusion.",
          "Si la fenetre est decalee, tu dois le signaler clairement dans note et used_window.",
        ]),
  ].join(" ");
}

function normalizeAdviceText(value, maxLength = 220) {
  return normalizeFreeText(typeof value === "string" ? value : "").slice(0, maxLength);
}

function normalizeAdviceList(value, maxItems) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeAdviceText(entry, 160))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeDisciplineAnalysisResult(parsed, language = "fr") {
  const summary = normalizeAdviceText(parsed?.summary, 320);
  const strengths = normalizeAdviceList(parsed?.strengths, 3);
  const warnings = normalizeAdviceList(parsed?.warnings, 4);
  const actions = normalizeAdviceList(parsed?.actions, 5);

  if (!summary || (!strengths.length && !warnings.length && !actions.length)) {
    throw new Error(getRadarServerCopy(language).disciplineInvalid);
  }

  return {
    summary,
    strengths,
    warnings,
    actions,
  };
}

function readRequestBody(request, maxBytes = MAX_RADAR_BODY_BYTES, language = "fr") {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;

    request.on("data", (chunk) => {
      size += chunk.length;

      if (size > maxBytes) {
        reject(createHttpError(413, getRadarServerCopy(language).requestTooLargeBody));
        request.destroy();
        return;
      }

      body += chunk.toString();
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function normalizeRadarResponseErrorMessage(error, fallback = getRadarServerCopy("fr").analysisUnavailable, language = "fr") {
  const copy = getRadarServerCopy(language);
  const message = error instanceof Error ? normalizeFreeText(error.message) : "";
  const normalized = message.toLowerCase();
  const statusCode = getErrorStatusCode(error);

  if (!message) {
    return fallback;
  }

  if (statusCode === 401 || statusCode === 403) {
    return copy.invalidSession;
  }

  if (
    statusCode === 413 ||
    isRequestTooLargeError(error) ||
    normalized.includes("request entity too large") ||
    normalized.includes("context length") ||
    normalized.includes("prompt is too long")
  ) {
    return copy.analysisRetry;
  }

  if (
    statusCode === 429 ||
    isTransientRadarError(error) ||
    normalized.includes("quota radar temporairement atteint") ||
    normalized.startsWith("typeerror:") ||
    normalized.includes("service unavailable") ||
    normalized.includes("temporarily unavailable") ||
    normalized.includes("overloaded") ||
    normalized.includes("gateway") ||
    normalized.includes("upstream") ||
    normalized.includes("too many requests")
  ) {
    return copy.busyNow;
  }

  if (
    normalized.includes("structured sports schedule request failed") ||
    normalized.includes("la recherche radar a pris trop de tours") ||
    normalized.includes("la requête radar a échoué") ||
    normalized.includes("radar request failed")
  ) {
    return fallback;
  }

  if (statusCode >= 500) {
    return fallback;
  }

  return normalizeFreeText(message || fallback);
}

function resolveRadarProvider({ groqApiKey, anthropicApiKey }) {
  if (groqApiKey) {
    return { name: RADAR_PROVIDER_GROQ, apiKey: groqApiKey };
  }

  if (anthropicApiKey) {
    return { name: RADAR_PROVIDER_ANTHROPIC, apiKey: anthropicApiKey };
  }

  return null;
}

function normalizeGroqMessageText(content) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }

      if (typeof entry?.text === "string") {
        return entry.text;
      }

      if (typeof entry?.content === "string") {
        return entry.content;
      }

      return "";
    })
    .join("\n")
    .trim();
}

async function requestGroqRadar(apiKey, payload, language = "fr") {
  const copy = getRadarServerCopy(language);
  let groqResponse = null;
  let groqPayload = null;

  for (
    let transientRetryIndex = 0;
    transientRetryIndex <= MAX_PROVIDER_TRANSIENT_RETRIES;
    transientRetryIndex += 1
  ) {
    try {
      for (let rateLimitRetryIndex = 0; rateLimitRetryIndex <= MAX_ANTHROPIC_RATE_LIMIT_RETRIES; rateLimitRetryIndex += 1) {
        groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
            "Groq-Model-Version": "latest",
          },
          body: JSON.stringify(payload),
        });

        groqPayload = await groqResponse.json().catch(() => null);

        if (groqResponse.ok) {
          break;
        }

        const errorMessage =
          typeof groqPayload?.error?.message === "string"
            ? groqPayload.error.message
            : copy.requestFailed;

        if (groqResponse.status === 413 || isRequestTooLargeMessage(errorMessage)) {
          throw createRequestTooLargeError(language);
        }

        if (groqResponse.status !== 429) {
          if (isRetriableProviderStatus(groqResponse.status) || isTransientProviderMessage(errorMessage)) {
            throw createTransientRadarError(undefined, language);
          }

          throw new Error(errorMessage);
        }

        const retryAfterSeconds = parseRetryAfterSeconds(groqResponse.headers.get("retry-after"));
        const retryDelayMs = Math.max(
          250,
          retryAfterSeconds !== null ? retryAfterSeconds * 1000 : DEFAULT_ANTHROPIC_RATE_LIMIT_RETRY_MS,
        );

        if (
          rateLimitRetryIndex < MAX_ANTHROPIC_RATE_LIMIT_RETRIES &&
          retryDelayMs <= MAX_ANTHROPIC_RATE_LIMIT_RETRY_MS
        ) {
          await wait(retryDelayMs);
          continue;
        }

        throw createTransientRadarError(undefined, language);
      }
    } catch (error) {
      if (isRequestTooLargeError(error)) {
        throw error;
      }

      if (error instanceof TypeError || isTransientRadarError(error)) {
        if (transientRetryIndex < MAX_PROVIDER_TRANSIENT_RETRIES) {
          await wait(PROVIDER_TRANSIENT_RETRY_DELAY_MS);
          continue;
        }

        throw createTransientRadarError(undefined, language);
      }

      throw error;
    }

    break;
  }

  if (!groqResponse?.ok) {
    throw createTransientRadarError(undefined, language);
  }

  const choice = Array.isArray(groqPayload?.choices) ? groqPayload.choices[0] : null;
  const messageText = normalizeGroqMessageText(choice?.message?.content);

  return {
    ...groqPayload,
    stop_reason: typeof choice?.finish_reason === "string" ? choice.finish_reason : "stop",
    content: messageText ? [{ type: "text", text: messageText }] : [],
  };
}

async function requestAnthropicRadar(apiKey, payload, language = "fr") {
  const copy = getRadarServerCopy(language);
  let requestPayload = { ...payload };

  for (let continuationIndex = 0; continuationIndex < MAX_ANTHROPIC_CONTINUATIONS; continuationIndex += 1) {
    let anthropicResponse = null;
    let anthropicPayload = null;

    for (
      let transientRetryIndex = 0;
      transientRetryIndex <= MAX_PROVIDER_TRANSIENT_RETRIES;
      transientRetryIndex += 1
    ) {
      try {
        for (let rateLimitRetryIndex = 0; rateLimitRetryIndex <= MAX_ANTHROPIC_RATE_LIMIT_RETRIES; rateLimitRetryIndex += 1) {
          anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "anthropic-version": "2023-06-01",
              "x-api-key": apiKey,
            },
            body: JSON.stringify(requestPayload),
          });

          anthropicPayload = await anthropicResponse.json().catch(() => null);

          if (anthropicResponse.ok) {
            break;
          }

          const errorMessage =
            typeof anthropicPayload?.error?.message === "string"
              ? anthropicPayload.error.message
              : copy.requestFailed;

          if (anthropicResponse.status === 413 || isRequestTooLargeMessage(errorMessage)) {
            throw createRequestTooLargeError(language);
          }

          if (anthropicResponse.status !== 429) {
            if (isRetriableProviderStatus(anthropicResponse.status) || isTransientProviderMessage(errorMessage)) {
              throw createTransientRadarError(undefined, language);
            }

            throw new Error(errorMessage);
          }

          const retryAfterSeconds = parseRetryAfterSeconds(anthropicResponse.headers.get("retry-after"));
          const retryDelayMs = Math.max(
            250,
            retryAfterSeconds !== null ? retryAfterSeconds * 1000 : DEFAULT_ANTHROPIC_RATE_LIMIT_RETRY_MS,
          );

          if (
            rateLimitRetryIndex < MAX_ANTHROPIC_RATE_LIMIT_RETRIES &&
            retryDelayMs <= MAX_ANTHROPIC_RATE_LIMIT_RETRY_MS
          ) {
            await wait(retryDelayMs);
            continue;
          }

          throw createTransientRadarError(undefined, language);
        }
      } catch (error) {
        if (isRequestTooLargeError(error)) {
          throw error;
        }

        if (error instanceof TypeError || isTransientRadarError(error)) {
          if (transientRetryIndex < MAX_PROVIDER_TRANSIENT_RETRIES) {
            await wait(PROVIDER_TRANSIENT_RETRY_DELAY_MS);
            continue;
          }

          throw createTransientRadarError(undefined, language);
        }

        throw error;
      }

      break;
    }

    if (!anthropicResponse?.ok) {
      throw createTransientRadarError(undefined, language);
    }

    if (anthropicPayload?.stop_reason !== "pause_turn" || !Array.isArray(anthropicPayload?.content)) {
      return anthropicPayload;
    }

    const previousMessages = Array.isArray(requestPayload.messages) ? requestPayload.messages : [];

    requestPayload = {
      ...requestPayload,
      messages: [
        ...previousMessages,
        {
          role: "assistant",
          content: anthropicPayload.content,
        },
      ],
    };
  }

  throw createTransientRadarError(undefined, language);
}

async function requestRadarProvider(provider, { systemPrompt, userPrompt, maxTokens, temperature, allowWebSearch = false, language = "fr" }) {
  if (provider?.name === RADAR_PROVIDER_GROQ) {
    return requestGroqRadar(provider.apiKey, {
      model: GROQ_RADAR_MODEL,
      max_completion_tokens: maxTokens,
      temperature,
      response_format: { type: "json_object" },
      compound_custom: allowWebSearch
        ? {
            tools: {
              enabled_tools: ["web_search", "visit_website"],
            },
          }
        : undefined,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }, language);
  }

  return requestAnthropicRadar(provider.apiKey, {
    model: ANTHROPIC_RADAR_MODEL,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    tools: allowWebSearch ? anthropicRadarTools : undefined,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  }, language);
}

async function requestDisciplineProvider(provider, { systemPrompt, userPrompt, maxTokens, temperature, language = "fr" }) {
  if (provider?.name === RADAR_PROVIDER_GROQ) {
    return requestGroqRadar(provider.apiKey, {
      model: GROQ_RADAR_MODEL,
      max_completion_tokens: maxTokens,
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }, language);
  }

  return requestAnthropicRadar(provider.apiKey, {
    model: ANTHROPIC_RADAR_MODEL,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  }, language);
}

function createServerSupabaseClient(supabaseUrl, supabaseAnonKey, accessToken) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
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

function getBearerToken(headers) {
  const authorizationHeader = getHeaderValue(headers, "authorization");

  if (!authorizationHeader.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorizationHeader.slice(7).trim();
}

async function authenticateRadarUser(headers, supabaseUrl, supabaseAnonKey, language = "fr") {
  const copy = getRadarServerCopy(language);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw createHttpError(500, copy.serverSupabaseMissing);
  }

  const accessToken = getBearerToken(headers);

  if (!accessToken) {
    throw createHttpError(401, copy.invalidSession);
  }

  const client = createServerSupabaseClient(supabaseUrl, supabaseAnonKey, accessToken);
  const { data, error } = await client.auth.getUser(accessToken);

  if (error || !data?.user) {
    throw createHttpError(401, copy.invalidSession);
  }

  return { client, user: data.user, accessToken };
}

function normalizeUsageStatus(usedCount, remainingCount, usedOn, tokenBalance = 0) {
  const safeUsedCount = Math.max(0, Number.isFinite(usedCount) ? usedCount : 0);
  const safeRemainingCount = Math.max(0, Number.isFinite(remainingCount) ? remainingCount : RADAR_WEEKLY_LIMIT - safeUsedCount);
  const safeTokenBalance = Math.max(0, Number.isFinite(tokenBalance) ? tokenBalance : 0);

  return {
    usedCount: safeUsedCount,
    remainingCount: safeRemainingCount,
    limit: RADAR_WEEKLY_LIMIT,
    usedOn,
    tokenBalance: safeTokenBalance,
    canUseRadar: safeRemainingCount > 0 || safeTokenBalance > 0,
    nextAccessMode: safeRemainingCount > 0 ? "daily" : safeTokenBalance > 0 ? "token" : "blocked",
  };
}

async function claimServerRadarUsage(client, usedOn, language = "fr") {
  const copy = getRadarServerCopy(language);
  const { data, error } = await client.rpc("claim_radar_access", { target_day: usedOn });

  if (error) {
    throw createHttpError(500, copy.applySchema);
  }

  const payload = Array.isArray(data) ? data[0] : data;

  if (!payload) {
    throw createHttpError(500, copy.verifyQuota);
  }

  return {
    allowed: Boolean(payload.allowed),
    usageId: typeof payload.usage_id === "string" ? payload.usage_id : null,
    ledgerId: typeof payload.ledger_id === "string" ? payload.ledger_id : null,
    accessMode:
      payload.access_mode === "daily" || payload.access_mode === "token" || payload.access_mode === "blocked"
        ? payload.access_mode
        : "blocked",
    ...normalizeUsageStatus(
      Number(payload.used_count ?? 0),
      Number(payload.remaining_count ?? 0),
      usedOn,
      Number(payload.token_balance ?? 0),
    ),
  };
}

async function releaseServerRadarUsage(client, reservation, usedOn) {
  if (!reservation?.usageId && !reservation?.ledgerId) {
    return;
  }

  await client.rpc("refund_radar_access", {
    access_mode: reservation.accessMode ?? "daily",
    target_day: usedOn,
    access_usage_id: reservation.usageId ?? null,
    access_ledger_id: reservation.ledgerId ?? null,
  });
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

async function processRadarHttpRequest({
  groqApiKey,
  anthropicApiKey,
  supabaseUrl,
  supabaseAnonKey,
  requestMethod,
  requestUrl,
  headers,
  readBody,
}) {
  const pathname = getPathnameFromUrl(requestUrl);
  const isSuggestionsRoute = requestMethod === "POST" && pathname === "/api/radar";
  const isDisciplineRoute = requestMethod === "POST" && pathname === "/api/radar-discipline";

  if (!isSuggestionsRoute && !isDisciplineRoute) {
    return null;
  }

  let requestedLanguage = getAppLanguage(getHeaderValue(headers, "x-app-language").trim().toLowerCase());
  let copy = getRadarServerCopy(requestedLanguage);

  const provider = resolveRadarProvider({ groqApiKey, anthropicApiKey });

  if (!provider) {
    return {
      status: 500,
      payload: {
        error: copy.providerEnvMissing,
      },
    };
  }

  let reservation = null;
  let authContext = null;

  try {
    authContext = await authenticateRadarUser(headers, supabaseUrl, supabaseAnonKey, requestedLanguage);

    const rawBody = await readBody(requestedLanguage);
    let parsedBody = {};

    try {
      parsedBody = JSON.parse(rawBody || "{}");
    } catch {
      return { status: 400, payload: { error: copy.invalidJson } };
    }

    requestedLanguage =
      parsedBody?.language === "en" || parsedBody?.language === "fr"
        ? parsedBody.language
        : requestedLanguage;
    copy = getRadarServerCopy(requestedLanguage);

    if (isDisciplineRoute) {
      const statsSummary = normalizeFreeText(parsedBody?.statsSummary).slice(0, 1400);
      const recentResults = Array.isArray(parsedBody?.recentResults)
        ? parsedBody.recentResults
            .map((entry) => normalizeFreeText(entry).slice(0, 24))
            .filter(Boolean)
            .slice(0, MAX_DISCIPLINE_RECENT_RESULTS)
        : [];

      if (!statsSummary) {
        return { status: 400, payload: { error: copy.missingStats } };
      }

      const providerPayload = await requestDisciplineProvider(provider, {
        systemPrompt: buildDisciplineSystemPrompt(requestedLanguage),
        userPrompt:
          requestedLanguage === "en"
            ? [
                "Analyze this bettor profile without judging the person.",
                "Focus mainly on discipline, risk management, staking habits, and behavior patterns.",
                "Do not give any match pick.",
                `Stats summary: ${statsSummary}`,
                recentResults.length
                  ? `Recent settled sequence (most recent first): ${recentResults.join(", ")}.`
                  : "No usable recent sequence.",
              ].join(" ")
            : [
                "Analyse ce profil de parieur sans juger la personne.",
                "Repere surtout la discipline, la gestion du risque, les habitudes de mise et les angles de comportement.",
                "Ne donne aucun pronostic de match.",
                `Resume statistique: ${statsSummary}`,
                recentResults.length
                  ? `Sequence recente des tickets regles (du plus recent au plus ancien): ${recentResults.join(", ")}.`
                  : "Aucune sequence recente exploitable.",
              ].join(" "),
        maxTokens: 420,
        temperature: 0.2,
        language: requestedLanguage,
      });

      const parsedDisciplinePayload = extractRadarJsonPayload(providerPayload, requestedLanguage);

      return {
        status: 200,
        payload: {
          analysis: normalizeDisciplineAnalysisResult(parsedDisciplinePayload, requestedLanguage),
        },
      };
    }

    const sport = typeof parsedBody?.sport === "string" ? parsedBody.sport.trim() : "";
    const risk = typeof parsedBody?.risk === "string" ? parsedBody.risk.trim() : "";
    const startDate = isIsoDateInput(parsedBody?.startDate) ? String(parsedBody.startDate).trim() : "";
    const endDate = isIsoDateInput(parsedBody?.endDate) ? String(parsedBody.endDate).trim() : "";
    const historySummary =
      typeof parsedBody?.historySummary === "string"
        ? parsedBody.historySummary.trim().slice(0, MAX_RADAR_HISTORY_SUMMARY_CHARS)
        : "";
    const todayIso = getDoualaIsoDate();
    const currentUsagePeriodStart = getDoualaWeekStartIsoDate();

    if (!sport || !risk || !startDate || !endDate) {
      return { status: 400, payload: { error: copy.missingInputs } };
    }

    if (!allowedRadarSports.has(sport)) {
      return { status: 400, payload: { error: copy.unsupportedSport } };
    }

    if (!allowedRadarRisks.has(risk)) {
      return { status: 400, payload: { error: copy.invalidRisk } };
    }

    const requestedDayCount = countDaysInWindow(startDate, endDate);

    if (!Number.isFinite(requestedDayCount) || requestedDayCount < 1) {
      return { status: 400, payload: { error: copy.invalidWindow } };
    }

    if (requestedDayCount > MAX_RADAR_WINDOW_DAYS) {
      return {
        status: 400,
        payload: { error: copy.windowTooWide },
      };
    }

    if (endDate < todayIso) {
      return {
        status: 400,
        payload: {
          error: copy.pastWindow(todayIso),
        },
      };
    }

    const effectiveStartDate = startDate < todayIso ? todayIso : startDate;
    const effectiveEndDate = endDate < effectiveStartDate ? effectiveStartDate : endDate;

    reservation = await claimServerRadarUsage(authContext.client, currentUsagePeriodStart, requestedLanguage);

    if (!reservation.allowed) {
      return { status: 429, payload: { error: copy.quotaReached, usage: reservation } };
    }

    const historyContext = historySummary
      ? requestedLanguage === "en"
        ? `History: ${historySummary}.`
        : `Historique: ${historySummary}.`
      : copy.historyWeak;
    const marketGuide = getMarketGuideForSport(sport, requestedLanguage);
    const riskGuide = getRiskGuideForRadar(risk, requestedLanguage);
    const searchFocus = getSearchFocusForSport(sport, requestedLanguage);
    const attempts = buildRadarAttempts(effectiveStartDate, effectiveEndDate, requestedLanguage);
    let lastNoUsableSuggestions = false;

    for (const attempt of attempts) {
      const structuredEvents = await fetchStructuredRadarEventsForWindow(
        sport,
        attempt.startDate,
        attempt.endDate,
        todayIso,
      );
      const promptProfiles = ["full", "compact", "ultra"];
      const allowWebSearch = structuredEvents.length === 0;

      for (const promptProfile of promptProfiles) {
        const structuredEventsPrompt = buildStructuredEventsPrompt(structuredEvents, promptProfile, requestedLanguage);
        const userPrompt = buildRadarUserPrompt({
          sport,
          risk,
          todayIso,
          historyContext,
          marketGuide,
          riskGuide,
          searchFocus,
          attempt,
          structuredEventsPrompt,
          promptProfile,
          language: requestedLanguage,
        });

        try {
          const providerPayload = await requestRadarProvider(provider, {
            systemPrompt: buildRadarSystemPrompt(requestedLanguage),
            userPrompt,
            maxTokens: promptProfile === "ultra" ? 380 : promptProfile === "compact" ? 480 : 580,
            temperature: 0.2,
            allowWebSearch: allowWebSearch && promptProfile !== "ultra",
            language: requestedLanguage,
          });
          const parsedRadarPayload = extractRadarJsonPayload(providerPayload, requestedLanguage);
          const result = normalizeRadarResult(
            parsedRadarPayload,
            attempt.startDate,
            attempt.endDate,
            todayIso,
            attempt.shifted
              ? {
                  startDate: attempt.startDate,
                  endDate: attempt.endDate,
                  note: attempt.note,
                }
              : undefined,
            reservation,
            requestedLanguage,
          );

          return { status: 200, payload: result };
        } catch (error) {
          if (isRequestTooLargeError(error) && promptProfile !== "ultra") {
            continue;
          }

          if (isNoUsableSuggestionsError(error)) {
            lastNoUsableSuggestions = true;
            break;
          }

          if (isRequestTooLargeError(error)) {
            throw createTransientRadarError(copy.analysisRetry, requestedLanguage);
          }

          throw error;
        }
      }
    }

    if (lastNoUsableSuggestions) {
      return {
        status: 200,
        payload: {
          suggestions: [],
          window: {
            startDate: effectiveStartDate,
            endDate: effectiveEndDate,
            shifted: false,
            note: copy.noPlausiblePeriodAndNext,
          },
          usage: reservation,
        },
      };
    }

    return { status: 503, payload: { error: copy.busyNow } };
  } catch (error) {
    if ((reservation?.usageId || reservation?.ledgerId) && authContext?.client) {
      try {
        await releaseServerRadarUsage(authContext.client, reservation, reservation.usedOn ?? getDoualaWeekStartIsoDate());
      } catch {
        // Ignore quota rollback errors and prefer surfacing the Radar failure itself.
      }
    }

    const message = normalizeRadarResponseErrorMessage(error, copy.analysisUnavailable, requestedLanguage);
    return { status: getErrorStatusCode(error), payload: { error: message } };
  }
}

export function createRadarRequestHandler({ groqApiKey, anthropicApiKey, supabaseUrl, supabaseAnonKey }) {
  return async function handleRadarRequest(request, response) {
    const requestLanguage = getAppLanguage(getHeaderValue(request.headers, "x-app-language").trim().toLowerCase());
    const result = await processRadarHttpRequest({
      groqApiKey,
      anthropicApiKey,
      supabaseUrl,
      supabaseAnonKey,
      requestMethod: request.method,
      requestUrl: request.url,
      headers: request.headers,
      readBody: (language) => readRequestBody(request, MAX_RADAR_BODY_BYTES, language || requestLanguage),
    });

    if (!result) {
      return false;
    }

    sendJson(response, result.status, result.payload);
    return true;
  };
}

export async function handlePagesRadarRequest(context, options) {
  const result = await processRadarHttpRequest({
    ...options,
    requestMethod: context.request.method,
    requestUrl: context.request.url,
    headers: context.request.headers,
    readBody: () => context.request.text(),
  });

  if (!result) {
    return typeof context.next === "function" ? context.next() : buildJsonResponse(404, { error: "Not found." });
  }

  return buildJsonResponse(result.status, result.payload);
}
