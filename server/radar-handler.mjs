import { createClient } from "@supabase/supabase-js";

const RADAR_DAILY_LIMIT = 2;
const MAX_RADAR_BODY_BYTES = 16 * 1024;
const MAX_RADAR_WINDOW_DAYS = 7;
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
  "Tu renvoies un seul objet JSON brut, sans markdown, sans commentaire, sans texte avant ou apres.",
  "Réponds uniquement en JSON.",
].join(" ");

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
  return Array.from({ length: 3 }, (_, index) => {
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
    .slice(0, 3);

  if (!suggestions.length) {
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

  for (let continuationIndex = 0; continuationIndex < 3; continuationIndex += 1) {
    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(requestPayload),
    });

    const anthropicPayload = await anthropicResponse.json().catch(() => null);

    if (!anthropicResponse.ok) {
      if (anthropicResponse.status === 429) {
        throw new Error("Quota Radar temporairement atteint. Attends environ 1 minute puis relance.");
      }

      const errorMessage =
        typeof anthropicPayload?.error?.message === "string"
          ? anthropicPayload.error.message
          : "La requête Radar a échoué.";
      throw new Error(errorMessage);
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

  throw new Error("La recherche Radar a pris trop de tours.");
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

function getHeaderValue(request, headerName) {
  const normalizedName = headerName.toLowerCase();
  const value = request.headers?.[normalizedName];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return typeof value === "string" ? value : "";
}

function getBearerToken(request) {
  const authorizationHeader = getHeaderValue(request, "authorization");

  if (!authorizationHeader.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorizationHeader.slice(7).trim();
}

async function authenticateRadarUser(request, supabaseUrl, supabaseAnonKey) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw createHttpError(500, "Supabase serveur manquant pour securiser Radar.");
  }

  const accessToken = getBearerToken(request);

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

function normalizeUsageStatus(usedCount, remainingCount, usedOn) {
  const safeUsedCount = Math.max(0, Number.isFinite(usedCount) ? usedCount : 0);
  const safeRemainingCount = Math.max(0, Number.isFinite(remainingCount) ? remainingCount : RADAR_DAILY_LIMIT - safeUsedCount);

  return {
    usedCount: safeUsedCount,
    remainingCount: safeRemainingCount,
    limit: RADAR_DAILY_LIMIT,
    usedOn,
  };
}

async function claimServerRadarUsage(client, usedOn) {
  const { data, error } = await client.rpc("claim_radar_usage", { target_day: usedOn });

  if (error) {
    throw createHttpError(500, "Applique le schema Supabase complet pour activer le quota Radar.");
  }

  const payload = Array.isArray(data) ? data[0] : data;

  if (!payload) {
    throw createHttpError(500, "Impossible de verifier le quota Radar du jour.");
  }

  return {
    allowed: Boolean(payload.allowed),
    usageId: typeof payload.usage_id === "string" ? payload.usage_id : null,
    ...normalizeUsageStatus(Number(payload.used_count ?? 0), Number(payload.remaining_count ?? 0), usedOn),
  };
}

async function releaseServerRadarUsage(client, usageId) {
  if (!usageId) {
    return;
  }

  await client.from("radar_usage").delete().eq("id", usageId);
}

export function createRadarRequestHandler({ apiKey, supabaseUrl, supabaseAnonKey }) {
  return async function handleRadarRequest(request, response) {
    const pathname = typeof request.url === "string" ? request.url.split("?")[0] : "";

    if (request.method !== "POST" || pathname !== "/api/radar") {
      return false;
    }

    if (!apiKey) {
      sendJson(response, 500, {
        error: "Ajoute ANTHROPIC_API_KEY dans ton .env pour activer Radar.",
      });
      return true;
    }

    let reservation = null;
    let authContext = null;

    try {
      authContext = await authenticateRadarUser(request, supabaseUrl, supabaseAnonKey);

      const rawBody = await readRequestBody(request);
      let parsedBody = {};

      try {
        parsedBody = JSON.parse(rawBody || "{}");
      } catch {
        sendJson(response, 400, { error: "JSON invalide." });
        return true;
      }

      const sport = typeof parsedBody?.sport === "string" ? parsedBody.sport.trim() : "";
      const risk = typeof parsedBody?.risk === "string" ? parsedBody.risk.trim() : "";
      const startDate = isIsoDateInput(parsedBody?.startDate) ? String(parsedBody.startDate).trim() : "";
      const endDate = isIsoDateInput(parsedBody?.endDate) ? String(parsedBody.endDate).trim() : "";
      const historySummary = typeof parsedBody?.historySummary === "string" ? parsedBody.historySummary.trim().slice(0, 500) : "";
      const todayIso = getDoualaIsoDate();

      if (!sport || !risk || !startDate || !endDate) {
        sendJson(response, 400, { error: "Sport, risque ou dates manquants." });
        return true;
      }

      if (!allowedRadarSports.has(sport)) {
        sendJson(response, 400, { error: "Sport non pris en charge." });
        return true;
      }

      if (!allowedRadarRisks.has(risk)) {
        sendJson(response, 400, { error: "Niveau de risque invalide." });
        return true;
      }

      const requestedDayCount = countDaysInWindow(startDate, endDate);

      if (!Number.isFinite(requestedDayCount) || requestedDayCount < 1) {
        sendJson(response, 400, { error: "Fenetre de dates invalide." });
        return true;
      }

      if (requestedDayCount > MAX_RADAR_WINDOW_DAYS) {
        sendJson(response, 400, { error: `Fenetre trop large. Maximum ${MAX_RADAR_WINDOW_DAYS} jours.` });
        return true;
      }

      if (endDate < todayIso) {
        sendJson(response, 400, {
          error: `La fenetre demandee est deja passee. Choisis une date a partir du ${todayIso}.`,
        });
        return true;
      }

      const effectiveStartDate = startDate < todayIso ? todayIso : startDate;
      const effectiveEndDate = endDate < effectiveStartDate ? effectiveStartDate : endDate;

      reservation = await claimServerRadarUsage(authContext.client, todayIso);

      if (!reservation.allowed) {
        sendJson(response, 429, { error: "Quota du jour atteint.", usage: reservation });
        return true;
      }

      const currentDateContext = `Date de reference aujourd'hui: ${todayIso}.`;
      const historyContext = historySummary
        ? `Contexte historique utilisateur: ${historySummary}.`
        : "Contexte historique utilisateur: aucun historique exploitable pour le moment.";
      const marketGuide = getMarketGuideForSport(sport);
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
          max_tokens: 620,
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
                "Tu peux retourner de 0 a 3 combines realistes avec 2 a 3 selections maximum par combine.",
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

          sendJson(response, 200, result);
          return true;
        } catch (error) {
          if (isNoUsableSuggestionsError(error)) {
            lastNoUsableSuggestions = true;
            continue;
          }

          throw error;
        }
      }

      if (lastNoUsableSuggestions) {
        sendJson(response, 200, {
          suggestions: [],
          window: {
            startDate: effectiveStartDate,
            endDate: effectiveEndDate,
            shifted: false,
            note: "Aucun evenement plausible sur la periode demandee ni sur la courte fenetre suivante.",
          },
          usage: reservation,
        });
        return true;
      }

      sendJson(response, 500, { error: "Analyse indisponible pour le moment." });
      return true;
    } catch (error) {
      if (reservation?.usageId && authContext?.client) {
        try {
          await releaseServerRadarUsage(authContext.client, reservation.usageId);
        } catch {
          // Ignore quota rollback errors and prefer surfacing the Radar failure itself.
        }
      }

      const message = error instanceof Error ? error.message : "Erreur interne sur Radar.";
      sendJson(response, getErrorStatusCode(error), { error: message });
      return true;
    }
  };
}
