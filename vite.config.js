import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function createRadarProxyPlugin(options) {
  let handlersPromise = null;

  async function getHandlers() {
    if (!handlersPromise) {
      handlersPromise = Promise.all([
        import("./server/radar-admin-handler.mjs"),
        import("./server/radar-handler.mjs"),
      ]).then(([adminModule, radarModule]) => ({
        handleRadarAdminRequest: adminModule.createRadarAdminRequestHandler(options),
        handleRadarRequest: radarModule.createRadarRequestHandler(options),
      }));
    }

    return handlersPromise;
  }

  async function forwardRequest(request, response, next) {
    const { handleRadarAdminRequest, handleRadarRequest } = await getHandlers();
    const handledAdmin = await handleRadarAdminRequest(request, response);

    if (handledAdmin) {
      return;
    }

    const handled = await handleRadarRequest(request, response);

    if (!handled) {
      next();
    }
  }

  return {
    name: "lucide-radar-proxy",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        forwardRequest(request, response, next).catch((error) => next(error));
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        forwardRequest(request, response, next).catch((error) => next(error));
      });
    },
  };
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const plugins = [react()];

  if (command !== "build") {
    plugins.push(
      createRadarProxyPlugin({
        groqApiKey: env.GROQ_API_KEY ?? "",
        anthropicApiKey: env.ANTHROPIC_API_KEY ?? "",
        supabaseUrl: env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? "",
        supabaseAnonKey: env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? "",
        supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY ?? "",
        adminPassword: env.RADAR_ADMIN_PASSWORD ?? "",
        adminSessionSecret: env.RADAR_ADMIN_SESSION_SECRET ?? "",
      }),
    );
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
