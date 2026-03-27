import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { createRadarRequestHandler } from "./server/radar-handler.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");
const envFilePath = path.join(__dirname, ".env");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

loadLocalEnv(envFilePath);

const port = Number.parseInt(process.env.PORT ?? "4173", 10);

const handleRadarRequest = createRadarRequestHandler({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "",
});

function loadLocalEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();

    if (!key || key in process.env) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function serveFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[extension] ?? "application/octet-stream";
  const stat = fs.statSync(filePath);

  response.statusCode = 200;
  response.setHeader("Content-Type", contentType);
  response.setHeader("Content-Length", stat.size);
  response.setHeader("Cache-Control", extension === ".html" ? "no-cache" : "public, max-age=31536000, immutable");
  fs.createReadStream(filePath).pipe(response);
}

function resolvePublicFile(requestPath) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const resolvedPath = path.resolve(distDir, `.${normalizedPath}`);

  if (!resolvedPath.startsWith(distDir)) {
    return "";
  }

  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    return "";
  }

  return resolvedPath;
}

const server = http.createServer(async (request, response) => {
  try {
    const handled = await handleRadarRequest(request, response);

    if (handled) {
      return;
    }

    if (!fs.existsSync(distDir)) {
      response.statusCode = 500;
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      response.end("Le dossier dist est introuvable. Lance d'abord npm run build.");
      return;
    }

    const requestPath = typeof request.url === "string" ? request.url.split("?")[0] : "/";
    const assetPath = resolvePublicFile(requestPath);

    if (assetPath) {
      serveFile(response, assetPath);
      return;
    }

    serveFile(response, path.join(distDir, "index.html"));
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Erreur serveur." }));
  }
});

server.listen(port, () => {
  console.log(`Lucide en ligne sur http://localhost:${port}`);
});
