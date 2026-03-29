import path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createRadarAdminRequestHandler } from "./server/radar-admin-handler.mjs";
import { createRadarRequestHandler } from "./server/radar-handler.mjs";

function createRadarProxyPlugin(options: {
  groqApiKey: string;
  anthropicApiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  adminPassword: string;
  adminSessionSecret: string;
}): Plugin {
  const handleRadarRequest = createRadarRequestHandler(options);
  const handleRadarAdminRequest = createRadarAdminRequestHandler(options);

  return {
    name: "lucide-radar-proxy",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const handledAdmin = await handleRadarAdminRequest(request, response);

        if (handledAdmin) {
          return;
        }

        const handled = await handleRadarRequest(request, response);

        if (!handled) {
          next();
        }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const handledAdmin = await handleRadarAdminRequest(request, response);

        if (handledAdmin) {
          return;
        }

        const handled = await handleRadarRequest(request, response);

        if (!handled) {
          next();
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      createRadarProxyPlugin({
        groqApiKey: env.GROQ_API_KEY ?? "",
        anthropicApiKey: env.ANTHROPIC_API_KEY ?? "",
        supabaseUrl: env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? "",
        supabaseAnonKey: env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? "",
        supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY ?? "",
        adminPassword: env.RADAR_ADMIN_PASSWORD ?? "",
        adminSessionSecret: env.RADAR_ADMIN_SESSION_SECRET ?? "",
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
