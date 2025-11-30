import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "@/index.css";
import App from "@/app";
import { registerServiceWorker } from "@/register-service-worker";
import { SaveStorageProvider } from "@/hooks/use-save-storage";
import { CurrentRomProvider } from "@/hooks/use-current-rom";
import { EmulatorProvider } from "@/hooks/use-emulator";
import { HomePage } from "@/routes/home";
import { EmulatorPage } from "@/routes/emulator";
import { LoginForm } from "@/components/login-form";
import { AuthProvider } from "@/hooks/use-auth";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <CurrentRomProvider>
        <SaveStorageProvider>
          <EmulatorProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<App />}>
                  <Route index element={<HomePage />} />
                  <Route path="/emulator" element={<EmulatorPage />} />
                  <Route path="/login" element={<LoginForm />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </EmulatorProvider>
        </SaveStorageProvider>
      </CurrentRomProvider>
    </AuthProvider>
  </StrictMode>,
);

registerServiceWorker();
