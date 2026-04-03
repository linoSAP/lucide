import { getCopy } from "@/lib/copy";
import { useLanguageStore } from "@/store/use-language-store";

export function SplashScreen() {
  const language = useLanguageStore((state) => state.language);
  const copy = getCopy(language);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="surface hairline w-full max-w-sm rounded-[24px] p-8 text-center shadow-soft">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/12" />
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Lucide</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">{copy.splash.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{copy.splash.description}</p>
      </div>
    </div>
  );
}
