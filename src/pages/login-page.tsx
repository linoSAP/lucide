import { Navigate } from "react-router-dom";
import { LoginScreen } from "@/components/auth/login-screen";
import { SplashScreen } from "@/components/auth/splash-screen";
import { useAuthStore } from "@/store/use-auth-store";

export function LoginPage() {
  const session = useAuthStore((state) => state.session);
  const status = useAuthStore((state) => state.status);

  if (status === "loading") {
    return <SplashScreen />;
  }

  if (session) {
    return (
      <Navigate
        replace
        to="/dashboard"
      />
    );
  }

  return <LoginScreen />;
}
