import { handlePagesRadarAdminRequest } from "../../../../server/radar-admin-handler.mjs";

export async function onRequest(context) {
  return handlePagesRadarAdminRequest(context, {
    supabaseUrl: context.env.SUPABASE_URL ?? context.env.VITE_SUPABASE_URL ?? "",
    supabaseServiceRoleKey: context.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    adminPassword: context.env.RADAR_ADMIN_PASSWORD ?? "",
    adminSessionSecret: context.env.RADAR_ADMIN_SESSION_SECRET ?? "",
  });
}
