import { createClient } from "@supabase/supabase-js";

const RADAR_WEEKLY_LIMIT = 2;
const MAX_RADAR_BODY_BYTES = 16 * 1024;
const MAX_RADAR_WINDOW_DAYS = 7;
const MAX_ANTHROPIC_CONTINUATIONS = 5;
const MAX_ANTHROPIC_NETWORK_RETRIES = 4;
const MAX_ANTHROPIC_RATE_LIMIT_RETRIES = 4;
const MAX_ANTHROPIC_RATE_LIMIT_RETRY_MS = 90000;
const DEFAULT_ANTHROPIC_NETWORK_RETRY_MS = 2500;
const DEFAULT_ANTHROPIC_RATE_LIMIT_RETRY_MS = 10000;
const MAX_ANTHROPIC_TOOL_RETRY_MAX_TOKENS = 1600;
const allowedRadarSports = new Set(["Football", "Basketball", "Tennis"]);
const allowedRadarRisks = new Set(["prudent", "balanced", "aggressive"]);

const anthropicSystemPrompt = [
  "Tu es un analyste de paris sportifs expérimenté.",
  "Tu proposes uniquement des combines bases sur des evenements verifiables et a venir.",
  "Tu verifies via la recherche web disponible que chaque evenement est bien a venir avant de le proposer.",
  "Tu ne proposes jamais un match ou un evenement deja passe.",
  "Si tu n'es pas raisonnablement sur qu'un evenement est a venir dans la fenetre demandee, tu l'exclus.",
  "Si aucun evenement plausible n'est disponible dans la fenetre demandee, tu peux te decaler legerement vers une fenetre suivante proche.",
  "Tu n'inventes jamais une date, une heure, une competition ou un detail de calendrier.",
  "Chaque selection doit fournir competition, event et event_date verifiee au format YYYY-MM-DD.",
  "event contient uniquement les deux equipes ou joueurs; la date apparait seulement dans event_date.",
  "Tu refuses toute formulation vague du type match de Premier League, equipe favorite a domicile, match allemand ou affiche a definir.",
  "Tu diversifies les marches proposes et tu evites de ne proposer que des victoires seches ou des totaux.",
  "Tu evites les marches obscurs et les player props.",
  "Tu tiens compte de la fenetre de dates demandee quand elle est fournie.",
  "Si tu ne peux pas verifier un evenement a venir avec sa date, tu ne le proposes pas.",
  "Pour un evenement prevu aujourd'hui, tu verifies qu'il n'a pas deja commence; au moindre doute, tu l'exclus.",
  "Tu restes tres concis: label court, rationale et caution breves, sans texte inutile.",
  "Tu renvoies un seul objet JSON brut, sans markdown, sans commentaire, sans texte avant ou apres.",
  "Réponds uniquement en JSON.",
].join(" ");

const anthropicRadarTools = [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }];

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

function getRadarServiceUnavailableMessage() {
  return "Radar est temporairement indisponible. Reessaie un peu plus tard.";
}

function getMaskedRadarUpstreamErrorMessage(statusCode, rawMessage) {
  const normalizedMessage = typeof rawMessage === "string" ? rawMessage.toLowerCase() : "";

  if (
    normalizedMessage.includes("credit balance is too low") ||
    normalizedMessage.includes("plans & billing") ||
    normalizedMessage.includes("purchase credits") ||
    normalizedMessage.includes("billing")
  ) {
    return getRadarServiceUnavailableMessage();
  }

  if (
    normalizedMessage.includes("api key") ||
    normalizedMessage.includes("authentication") ||
    normalizedMessage.includes("unauthorized") ||
    normalizedMessage.includes("forbidden")
  ) {
    return getRadarServiceUnavailableMessage();
  }

  if (statusCode >= 400) {
    return getRadarServiceUnavailableMessage();
  }

  return "Analyse indisponible pour le moment.";
}

function getMaskedRadarInternalErrorMessage(error) {
  const rawMessage = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const normalizedMessage = rawMessage.toLowerCase();

  if (
    normalizedMessage.includes("fetch failed") ||
    normalizedMessage.includes("network") ||
    normalizedMessage.includes("socket") ||
    normalizedMessage.includes("econnreset") ||
    normalizedMessage.includes("etimedout") ||
    normalizedMessage.includes("timeout")
  ) {
    return getRadarServiceUnavailableMessage();
  }

  return rawMessage || "Erreur interne sur Radar.";
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

function extractRadarJsonPayload(payload) {
  if (!Array.isArray(payload?.content)) {
    throw new Error("La reponse Radar est vide.");
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

  throw new Error("La reponse Radar n'est pas un JSON exploitable.");
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

function buildShiftNote(requestedStartDate, requestedEndDate, nextStartDate, nextEndDate) {
  if (nextStartDate === nextEndDate) {
    return `Aucun evenement plausible entre ${requestedStartDate} et ${requestedEndDate}. Radar a glisse vers le ${nextStartDate}.`;
  }

  return `Aucun evenement plausible entre ${requestedStartDate} et ${requestedEndDate}. Radar a glisse vers une fenetre proche, du ${nextStartDate} au ${nextEndDate}.`;
}

function buildRadarAttempts(requestedStartDate, requestedEndDate) {
  return Array.from({ length: 6 }, (_, index) => {
    const offset = index;
    const startDate = addDaysToIsoDate(requestedStartDate, offset);
    const endDate = addDaysToIsoDate(requestedEndDate, offset);

    return {
      startDate,
      endDate,
      shifted: offset > 0,
      note: offset > 0 ? buildShiftNote(requestedStartDate, requestedEndDate, startDate, endDate) : "",
    };
  });
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

function buildExplicitNoSuggestionsResult(parsed, requestedStartDate, requestedEndDate, fallbackWindow, usage) {
  if (Array.isArray(parsed) || !Array.isArray(parsed?.suggestions) || parsed.suggestions.length > 0) {
    return null;
  }

  const payloadWindow = readRadarWindowFromPayload(parsed);
  const startDate = payloadWindow?.startDate ?? fallbackWindow?.startDate ?? requestedStartDate;
  const endDate = payloadWindow?.endDate ?? fallbackWindow?.endDate ?? requestedEndDate;
  const note =
    normalizeFreeText(parsed?.note) ||
    fallbackWindow?.note ||
    "Aucun evenement plausible sur la periode demandee.";
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

function normalizeRadarResult(parsed, requestedStartDate, requestedEndDate, todayIso, fallbackWindow, usage) {
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
          : "Vigilance sur compos, rotation ou contexte avant validation.";
      const uniqueLegs = legs.filter((leg, index) => {
        const signature = `${leg.competition}|${leg.event}|${leg.eventDate}|${leg.market}|${leg.pick}`;
        return legs.findIndex((entry) => {
          return `${entry.competition}|${entry.event}|${entry.eventDate}|${entry.market}|${entry.pick}` === signature;
        }) === index;
      });

      if (uniqueLegs.length < 2 || !oddsValue || !rationale) {
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
        label: label || "Angle",
        legs: uniqueLegs,
        odds: oddsValue,
        rationale,
        caution,
      };
    })
    .filter(Boolean)
    .slice(0, 4);

  if (!suggestions.length) {
    const explicitNoSuggestionsResult = buildExplicitNoSuggestionsResult(
      parsed,
      requestedStartDate,
      requestedEndDate,
      fallbackWindow,
      usage,
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

function getMarketGuideForSport(sport) {
  if (sport === "Football") {
    return "Marches a privilegier: double chance, draw no bet, under/over buts, both teams to score, handicap prudent, team total.";
  }

  if (sport === "Basketball") {
    return "Marches a privilegier: handicap/spread, moneyline, total points match, total equipe, resultat mi-temps avec moderation.";
  }

  if (sport === "Tennis") {
    return "Marches a privilegier: vainqueur du match, vainqueur du premier set, handicap jeux, total jeux, handicap sets.";
  }

  return "Varie les marches de maniere prudente.";
}

function getSearchFocusForSport(sport) {
  if (sport === "Football") {
    return "Priorite aux grandes ligues et coupes avec calendrier public fiable, sur sites officiels ou medias sportifs reconnus.";
  }

  if (sport === "Basketball") {
    return "Priorite aux calendriers publics NBA, EuroLeague et grandes competitions nationales clairement programmees; evite les affiches floues ou mal datees.";
  }

  if (sport === "Tennis") {
    return "Priorite aux matchs ATP, WTA et Challenger avec ordre de jeu ou calendrier officiel clairement publie; propose seulement des affiches singles dont la date est verifiee.";
  }

  return "Priorite aux competitions avec calendrier public fiable.";
}

function readRequestBody(request, maxBytes = MAX_RADAR_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;

    request.on("data", (chunk) => {
      size += chunk.length;

      if (size > maxBytes) {
        reject(createHttpError(413, "Requete trop volumineuse."));
        request.destroy();
        return;
      }

      body += chunk.toString();
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function requestAnthropicRadar(apiKey, payload) {
  let requestPayload = { ...payload };
  const accumulatedContent = [];
  let didRetryToolUseAfterMaxTokens = false;

  for (let continuationIndex = 0; continuationIndex < MAX_ANTHROPIC_CONTINUATIONS; continuationIndex += 1) {
    let anthropicResponse = null;
    let anthropicPayload = null;

    for (let rateLimitRetryIndex = 0; rateLimitRetryIndex <= MAX_ANTHROPIC_RATE_LIMIT_RETRIES; rateLimitRetryIndex += 1) {
      try {
        anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "anthropic-version": "2023-06-01",
            "x-api-key": apiKey,
          },
          body: JSON.stringify(requestPayload),
        });
      } catch (error) {
        if (rateLimitRetryIndex < MAX_ANTHROPIC_NETWORK_RETRIES) {
          await wait(DEFAULT_ANTHROPIC_NETWORK_RETRY_MS * (rateLimitRetryIndex + 1));
          continue;
        }

        console.error("[radar] Upstream network failure.", error);
        throw new Error(getRadarServiceUnavailableMessage());
      }

      anthropicPayload = await anthropicResponse.json().catch(() => null);

      if (anthropicResponse.ok) {
        break;
      }

      if (anthropicResponse.status !== 429) {
        const rawErrorMessage =
          typeof anthropicPayload?.error?.message === "string"
            ? anthropicPayload.error.message
            : "";
        console.error("[radar] Upstream provider error.", anthropicResponse.status, rawErrorMessage || "<empty>");
        throw new Error(getMaskedRadarUpstreamErrorMessage(anthropicResponse.status, rawErrorMessage));
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

      console.error(
        "[radar] Upstream provider rate limit exhausted.",
        retryAfterSeconds !== null ? `retry-after=${retryAfterSeconds}s` : "retry-after=<missing>",
      );
      throw new Error(getRadarServiceUnavailableMessage());
    }

    if (!anthropicResponse?.ok) {
      throw new Error("La requête Radar a échoué.");
    }

    if (!Array.isArray(anthropicPayload?.content)) {
      return anthropicPayload;
    }

    accumulatedContent.push(...anthropicPayload.content);

    if (anthropicPayload?.stop_reason === "pause_turn") {
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
      continue;
    }

    if (anthropicPayload?.stop_reason === "max_tokens") {
      const lastContentBlock = anthropicPayload.content[anthropicPayload.content.length - 1] ?? null;

      if (lastContentBlock?.type === "tool_use" && !didRetryToolUseAfterMaxTokens) {
        didRetryToolUseAfterMaxTokens = true;
        accumulatedContent.length = 0;
        requestPayload = {
          ...payload,
          max_tokens: Math.max(Number(payload?.max_tokens ?? 0), MAX_ANTHROPIC_TOOL_RETRY_MAX_TOKENS),
        };
        continue;
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
          {
            role: "user",
            content: "Continue uniquement le JSON Radar en cours, sans recommencer, sans markdown et sans texte hors JSON.",
          },
        ],
      };
      continue;
    }

    return {
      ...anthropicPayload,
      content: accumulatedContent,
    };
  }

  throw new Error("La reponse Radar a ete coupee trop tot. Relance l'analyse.");
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

async function authenticateRadarUser(headers, supabaseUrl, supabaseAnonKey) {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[radar] Missing server auth configuration for secured Radar requests.");
    throw createHttpError(500, getRadarServiceUnavailableMessage());
  }

  const accessToken = getBearerToken(headers);

  if (!accessToken) {
    throw createHttpError(401, "Session invalide. Reconnecte-toi.");
  }

  const client = createServerSupabaseClient(supabaseUrl, supabaseAnonKey, accessToken);
  const { data, error } = await client.auth.getUser(accessToken);

  if (error || !data?.user) {
    throw createHttpError(401, "Session invalide. Reconnecte-toi.");
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

async function claimServerRadarUsage(client, usedOn) {
  const { data, error } = await client.rpc("claim_radar_access", { target_day: usedOn });

  if (error) {
    console.error("[radar] Unable to claim radar usage.", error.message);
    throw createHttpError(500, getRadarServiceUnavailableMessage());
  }

  const payload = Array.isArray(data) ? data[0] : data;

  if (!payload) {
    throw createHttpError(500, getRadarServiceUnavailableMessage());
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
  apiKey,
  supabaseUrl,
  supabaseAnonKey,
  requestMethod,
  requestUrl,
  headers,
  readBody,
}) {
  const pathname = getPathnameFromUrl(requestUrl);

  if (requestMethod !== "POST" || pathname !== "/api/radar") {
    return null;
  }

  if (!apiKey) {
    console.error("[radar] Missing provider API key.");
    return {
      status: 500,
      payload: {
        error: getRadarServiceUnavailableMessage(),
      },
    };
  }

  let reservation = null;
  let authContext = null;

  try {
    authContext = await authenticateRadarUser(headers, supabaseUrl, supabaseAnonKey);

    const rawBody = await readBody();
    let parsedBody = {};

    try {
      parsedBody = JSON.parse(rawBody || "{}");
    } catch {
      return { status: 400, payload: { error: "JSON invalide." } };
    }

    const sport = typeof parsedBody?.sport === "string" ? parsedBody.sport.trim() : "";
    const risk = typeof parsedBody?.risk === "string" ? parsedBody.risk.trim() : "";
    const startDate = isIsoDateInput(parsedBody?.startDate) ? String(parsedBody.startDate).trim() : "";
    const endDate = isIsoDateInput(parsedBody?.endDate) ? String(parsedBody.endDate).trim() : "";
    const historySummary = typeof parsedBody?.historySummary === "string" ? parsedBody.historySummary.trim().slice(0, 500) : "";
    const todayIso = getDoualaIsoDate();
    const currentUsagePeriodStart = getDoualaWeekStartIsoDate();

    if (!sport || !risk || !startDate || !endDate) {
      return { status: 400, payload: { error: "Sport, risque ou dates manquants." } };
    }

    if (!allowedRadarSports.has(sport)) {
      return { status: 400, payload: { error: "Sport non pris en charge." } };
    }

    if (!allowedRadarRisks.has(risk)) {
      return { status: 400, payload: { error: "Niveau de risque invalide." } };
    }

    const requestedDayCount = countDaysInWindow(startDate, endDate);

    if (!Number.isFinite(requestedDayCount) || requestedDayCount < 1) {
      return { status: 400, payload: { error: "Fenetre de dates invalide." } };
    }

    if (requestedDayCount > MAX_RADAR_WINDOW_DAYS) {
      return {
        status: 400,
        payload: { error: `Fenetre trop large. Maximum ${MAX_RADAR_WINDOW_DAYS} jours.` },
      };
    }

    if (endDate < todayIso) {
      return {
        status: 400,
        payload: {
          error: `La fenetre demandee est deja passee. Choisis une date a partir du ${todayIso}.`,
        },
      };
    }

    const effectiveStartDate = startDate < todayIso ? todayIso : startDate;
    const effectiveEndDate = endDate < effectiveStartDate ? effectiveStartDate : endDate;

    reservation = await claimServerRadarUsage(authContext.client, currentUsagePeriodStart);

    if (!reservation.allowed) {
      return { status: 429, payload: { error: "Quota de la semaine atteint. Obtiens des jetons pour continuer.", usage: reservation } };
    }

    const currentDateContext = `Date de reference aujourd'hui: ${todayIso}.`;
    const historyContext = historySummary
      ? `Contexte historique utilisateur: ${historySummary}.`
      : "Contexte historique utilisateur: aucun historique exploitable pour le moment.";
    const marketGuide = getMarketGuideForSport(sport);
    const searchFocus = getSearchFocusForSport(sport);
    const attempts = buildRadarAttempts(effectiveStartDate, effectiveEndDate);
    let lastNoUsableSuggestions = false;

    for (const attempt of attempts) {
      const dateContext =
        attempt.startDate === attempt.endDate
          ? `Fenetre souhaitee: ${attempt.startDate}.`
          : `Fenetre souhaitee: du ${attempt.startDate} au ${attempt.endDate}.`;
      const fallbackContext = attempt.shifted
        ? `Fenetre de repli automatique autorisee: du ${attempt.startDate} au ${attempt.endDate}. Garde cette fenetre proche et signale clairement ce decalage.`
        : "Reste prioritairement dans la fenetre demandee.";

      const anthropicPayload = await requestAnthropicRadar(apiKey, {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1200,
        temperature: 0.2,
        system: anthropicSystemPrompt,
        tools: anthropicRadarTools,
        messages: [
          {
            role: "user",
            content: [
              `Sport: ${sport}.`,
              `Risque: ${risk}.`,
              currentDateContext,
              dateContext,
              fallbackContext,
              historyContext,
              marketGuide,
              searchFocus,
              "Tu peux retourner de 0 a 4 combines realistes avec 2 a 3 selections maximum par combine.",
              "Ne cite jamais un match deja joue, une finale historique ou un tournoi termine.",
              `Aucune selection ne doit avoir un event_date en dehors de la fenetre ${attempt.startDate} -> ${attempt.endDate} ni avant ${todayIso}.`,
              "Si tu n'es pas sur qu'un evenement est a venir dans la fenetre demandee, tu l'exclus au lieu de deviner.",
              "Si aucun evenement plausible n'existe dans la fenetre demandee, tu peux te decaler vers la prochaine fenetre utile, au maximum 3 jours apres la fin demandee.",
              "N'ecris jamais d'heure exacte.",
              "Pour un evenement qui tombe aujourd'hui, verifie aussi qu'il est encore a venir; s'il y a un doute sur l'horaire ou le statut, exclue-le.",
              "Chaque leg doit contenir competition, event, event_date, market et pick. competition = tournoi ou championnat. event = les deux equipes ou joueurs seulement. event_date = YYYY-MM-DD verifie.",
              "Si la date d'un evenement n'est pas clairement verifiee, exclue cet evenement.",
              "Diversifie les marches sur les suggestions quand c'est plausible.",
              "Evite de reutiliser les memes affiches sauf si c'est vraiment incontournable.",
              "N'abuse pas des simples vainqueurs et n'abuse pas des overs/unders.",
              "Si tu ne peux pas produire une suggestion plausible sans halluciner, retourne suggestions: [].",
              "Pour chaque combine, retourne un label court, les selections, la cote estimee, une logique concise et un point de vigilance concis.",
              "La reponse doit etre un seul objet JSON brut, sans balise markdown et sans phrase d'introduction ou de conclusion.",
              "Si la fenetre est decalee, tu dois le signaler clairement dans note et used_window.",
              "Format JSON strict: {used_window:{start_date,end_date}, shifted:boolean, note:string, suggestions:[{label, legs:[{competition,event,event_date,market,pick}], odds, rationale, caution}]}",
            ].join(" "),
          },
        ],
      });

      try {
        const parsedRadarPayload = extractRadarJsonPayload(anthropicPayload);
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
        );

        return { status: 200, payload: result };
      } catch (error) {
        if (isNoUsableSuggestionsError(error)) {
          lastNoUsableSuggestions = true;
          continue;
        }

        throw error;
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
            note: "Aucun evenement plausible sur la periode demandee ni sur la courte fenetre suivante.",
          },
          usage: reservation,
        },
      };
    }

    return { status: 500, payload: { error: "Analyse indisponible pour le moment." } };
  } catch (error) {
    if ((reservation?.usageId || reservation?.ledgerId) && authContext?.client) {
      try {
        await releaseServerRadarUsage(authContext.client, reservation, reservation.usedOn ?? getDoualaWeekStartIsoDate());
      } catch {
        // Ignore quota rollback errors and prefer surfacing the Radar failure itself.
      }
    }

    const message = getMaskedRadarInternalErrorMessage(error);
    return { status: getErrorStatusCode(error), payload: { error: message } };
  }
}

export function createRadarRequestHandler({ apiKey, supabaseUrl, supabaseAnonKey }) {
  return async function handleRadarRequest(request, response) {
    const result = await processRadarHttpRequest({
      apiKey,
      supabaseUrl,
      supabaseAnonKey,
      requestMethod: request.method,
      requestUrl: request.url,
      headers: request.headers,
      readBody: () => readRequestBody(request),
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
