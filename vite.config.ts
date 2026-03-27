import path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createRadarRequestHandler } from "./server/radar-handler.mjs";

function createRadarProxyPlugin(options: { apiKey: string; supabaseUrl: string; supabaseAnonKey: string }): Plugin {
  const handleRadarRequest = createRadarRequestHandler(options);

  return {
    name: "lucide-radar-proxy",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const handled = await handleRadarRequest(request, response);

        if (!handled) {
          next();
        }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (request, response, next) => {
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
        apiKey: env.ANTHROPIC_API_KEY ?? "",
        supabaseUrl: env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? "",
        supabaseAnonKey: env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? "",
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
