export function SplashScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="surface hairline w-full max-w-sm rounded-[24px] p-8 text-center shadow-soft">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/12" />
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Lucide</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">Chargement</h1>
        <p className="mt-2 text-sm text-muted-foreground">Connexion a ton espace en cours.</p>
      </div>
    </div>
  );
}
