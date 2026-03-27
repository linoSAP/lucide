import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { SplashScreen } from "@/components/auth/splash-screen";
import { useAuthStore } from "@/store/use-auth-store";

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const status = useAuthStore((state) => state.status);
  const session = useAuthStore((state) => state.session);

  if (status === "loading") {
    return <SplashScreen />;
  }

  if (!session) {
    return (
      <Navigate
        replace
        to="/login"
      />
    );
  }

  return <>{children}</>;
}
