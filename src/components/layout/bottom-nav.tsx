import { BarChart3, NotebookText, Radar, UserRound } from "lucide-react";
import { NavLink } from "react-router-dom";
import { getCopy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { useLanguageStore } from "@/store/use-language-store";

export function BottomNav() {
  const language = useLanguageStore((state) => state.language);
  const copy = getCopy(language);
  const items = [
    {
      to: "/journal",
      label: copy.nav.journal,
      icon: NotebookText,
    },
    {
      to: "/dashboard",
      label: copy.nav.dashboard,
      icon: BarChart3,
    },
    {
      to: "/radar",
      label: copy.nav.radar,
      icon: Radar,
    },
    {
      to: "/profil",
      label: copy.nav.profile,
      icon: UserRound,
    },
  ];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 px-4">
      <nav className="pointer-events-auto mx-auto flex w-full max-w-md items-center justify-between rounded-full border border-border/8 bg-card/90 px-2 py-2 shadow-soft backdrop-blur-xl">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink key={item.to} to={item.to} className="flex-1">
              {({ isActive }) => (
                <span
                  className={cn(
                    "mx-1 flex flex-col items-center justify-center gap-1 rounded-full px-3 py-2 text-[11px] font-medium transition duration-200",
                    isActive ? "bg-secondary/92 text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span>{item.label}</span>
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
