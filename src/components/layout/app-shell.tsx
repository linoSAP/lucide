import { motion } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "@/components/layout/bottom-nav";
import { useAuthStore } from "@/store/use-auth-store";

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  "/journal": {
    title: "Journal",
    subtitle: "Saisir ses mises et garder une trace nette.",
  },
  "/dashboard": {
    title: "Tableau de bord",
    subtitle: "Voir la realite en chiffres, sans bruit.",
  },
  "/radar": {
    title: "Radar",
    subtitle: "Suggestions cadres par date, sans bruit.",
  },
  "/profil": {
    title: "Profil",
    subtitle: "Parametres, soutien et informations personnelles.",
  },
};

export function AppShell() {
  const location = useLocation();
  const session = useAuthStore((state) => state.session);

  const meta = pageMeta[location.pathname] ?? {
    title: "Lucide",
    subtitle: "Voir clair sur ses paris.",
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,230,118,0.1),_transparent_0_30%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-28 pt-6">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="mb-6 flex items-start justify-between gap-4"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Lucide</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">{meta.title}</h1>
            <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{meta.subtitle}</p>
          </div>

          <div className="rounded-full border border-border/8 bg-card/84 px-3 py-2 text-right text-xs text-muted-foreground shadow-soft">
            <p className="max-w-[7rem] truncate">{session?.user.email ?? "Session"}</p>
          </div>
        </motion.header>

        <main className="flex-1">
          <Outlet />
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
