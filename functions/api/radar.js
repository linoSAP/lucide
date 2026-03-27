import { handlePagesRadarRequest } from "../../server/radar-handler.mjs";

export async function onRequestPost(context) {
  return handlePagesRadarRequest(context, {
    apiKey: context.env.ANTHROPIC_API_KEY ?? "",
    supabaseUrl: context.env.SUPABASE_URL ?? context.env.VITE_SUPABASE_URL ?? "",
    supabaseAnonKey: context.env.SUPABASE_ANON_KEY ?? context.env.VITE_SUPABASE_ANON_KEY ?? "",
  });
}
