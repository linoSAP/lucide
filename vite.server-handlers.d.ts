interface RadarProxyOptions {
  groqApiKey: string;
  anthropicApiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  adminPassword: string;
  adminSessionSecret: string;
}

type RadarProxyHandler = (request: unknown, response: unknown) => Promise<boolean>;

declare module "./server/radar-handler.mjs" {
  export function createRadarRequestHandler(options: RadarProxyOptions): RadarProxyHandler;
}

declare module "./server/radar-admin-handler.mjs" {
  export function createRadarAdminRequestHandler(options: RadarProxyOptions): RadarProxyHandler;
}
