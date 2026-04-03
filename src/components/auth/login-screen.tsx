import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { LockKeyhole, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCopy } from "@/lib/copy";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/use-auth-store";
import { useLanguageStore } from "@/store/use-language-store";
import logo from "@/assets/lucide_logo.svg";

type AuthMode = "sign-in" | "sign-up";
type LoginMessageKind = "verify" | "ready" | null;

export function LoginScreen() {
  const signInWithPassword = useAuthStore((state) => state.signInWithPassword);
  const signUpWithPassword = useAuthStore((state) => state.signUpWithPassword);
  const language = useLanguageStore((state) => state.language);
  const copy = getCopy(language);
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<LoginMessageKind>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignUp = mode === "sign-up";
  const isFormReady = email.trim().length > 0 && password.trim().length > 0;

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setMessage(null);
    setMessageKind(null);
    setPassword("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    setMessageKind(null);

    if (isSignUp) {
      const result = await signUpWithPassword(email.trim(), password);

      if (result.error) {
        setError(result.error);
        setIsSubmitting(false);
        return;
      }

      setPassword("");

      if (result.requiresEmailConfirmation) {
        setMessage(copy.login.createdAccountVerify(email.trim()));
        setMessageKind("verify");
        setMode("sign-in");
      } else {
        setMessage(copy.login.createdAccountConnecting);
        setMessageKind("ready");
      }

      setIsSubmitting(false);
      return;
    }

    const result = await signInWithPassword(email.trim(), password);

    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    setPassword("");
    setIsSubmitting(false);
  }

  const title = isSignUp ? copy.login.titleSignUp : copy.login.titleSignIn;
  const description = isSignUp
    ? copy.login.descriptionSignUp
    : copy.login.descriptionSignIn;

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,230,118,0.14),_transparent_0_35%)]" />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        <Card className="rounded-[24px]">
          <CardHeader className="space-y-4 pb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="inline-flex rounded-[20px] bg-[#101010] px-4 py-3 shadow-soft">
              <img
                src={logo}
                alt="Lucide logo"
                className="h-24 w-auto opacity-90"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 rounded-[18px] bg-secondary/88 p-1">
              <button
                type="button"
                className={cn(
                  "rounded-[14px] px-4 py-2 text-sm font-medium transition",
                  mode === "sign-in" ? "bg-card/92 text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => switchMode("sign-in")}
              >
                {copy.login.signInTab}
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-[14px] px-4 py-2 text-sm font-medium transition",
                  mode === "sign-up" ? "bg-card/92 text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => switchMode("sign-up")}
              >
                {copy.login.signUpTab}
              </button>
            </div>

            <div className="mt-5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>

            {message ? (
              <div className="mt-4 space-y-3 rounded-[18px] bg-primary/8 p-5">
                <div className="flex items-center gap-3 text-primary">
                  <Mail className="h-5 w-5" />
                  <p className="text-sm font-medium">
                    {messageKind === "verify" ? copy.login.verifyEmailTitle : copy.login.accountReadyTitle}
                  </p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{message}</p>
              </div>
            ) : null}

            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm text-muted-foreground">
                  {copy.login.emailLabel}
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={copy.login.emailPlaceholder}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm text-muted-foreground">
                  {copy.login.passwordLabel}
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    placeholder={copy.login.passwordPlaceholder}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <LockKeyhole className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              {isSignUp ? (
                <p className="text-xs leading-6 text-muted-foreground">
                  {copy.login.passwordHint}
                </p>
              ) : null}

              {!isSupabaseConfigured ? (
                <p className="rounded-[14px] bg-negative/10 px-4 py-3 text-sm text-negative">
                  {copy.login.envMissing}
                </p>
              ) : null}

              {error ? <p className="text-sm text-negative">{error}</p> : null}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={!isFormReady || isSubmitting || !isSupabaseConfigured}
              >
                {isSubmitting
                  ? isSignUp
                    ? copy.login.signingUp
                    : copy.login.signingIn
                  : isSignUp
                    ? copy.login.signUpCta
                    : copy.login.signInCta}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
