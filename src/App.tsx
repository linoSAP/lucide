import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardPage } from "@/pages/dashboard-page";
import { JournalPage } from "@/pages/journal-page";
import { LoginPage } from "@/pages/login-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { ProfilePage } from "@/pages/profile-page";
import { RadarPage } from "@/pages/radar-page";
import { useAuthStore } from "@/store/use-auth-store";
import { useCurrencyStore } from "@/store/use-currency-store";
import { useLanguageStore } from "@/store/use-language-store";

export default function App() {
  const initialize = useAuthStore((state) => state.initialize);
  const profileLanguage = useAuthStore((state) => state.profile?.language);
  const profileCurrency = useAuthStore((state) => state.profile?.currency);
  const syncLanguageFromProfile = useLanguageStore((state) => state.syncLanguageFromProfile);
  const syncCurrencyFromProfile = useCurrencyStore((state) => state.syncCurrencyFromProfile);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    syncLanguageFromProfile(profileLanguage);
  }, [profileLanguage, syncLanguageFromProfile]);

  useEffect(() => {
    syncCurrencyFromProfile(profileCurrency);
  }, [profileCurrency, syncCurrencyFromProfile]);

  return (
    <Routes>
      <Route
        path="/login"
        element={<LoginPage />}
      />
      <Route
        element={
          <AuthGuard>
            <AppShell />
          </AuthGuard>
        }
      >
        <Route
          index
          element={
            <Navigate
              replace
              to="/dashboard"
            />
          }
        />
        <Route
          path="/journal"
          element={<JournalPage />}
        />
        <Route
          path="/dashboard"
          element={<DashboardPage />}
        />
        <Route
          path="/radar"
          element={<RadarPage />}
        />
        <Route
          path="/profil"
          element={<ProfilePage />}
        />
        <Route
          path="*"
          element={<NotFoundPage />}
        />
      </Route>
    </Routes>
  );
}
