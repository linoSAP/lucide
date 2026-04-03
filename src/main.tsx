import "@fontsource/inter";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "@/App";
import "@/index.css";
import { initializeLanguagePreference } from "@/lib/language";
import { initializeThemePreference } from "@/lib/theme";

initializeThemePreference();
initializeLanguagePreference();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
