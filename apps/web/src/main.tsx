import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Router, Route, LocationProvider } from "preact-iso";
import "@/index.css";
import App from "@/app";
import { registerServiceWorker } from "@/register-service-worker";
import { SaveStorageProvider } from "@/hooks/use-save-storage";
import { CurrentRomProvider } from "@/hooks/use-current-rom";
import { EmulatorProvider } from "@/hooks/use-emulator";
import { GameOptionsProvider } from "@/hooks/use-game-options";
import { HomePage } from "@/routes/home";
import { EmulatorPage } from "@/routes/emulator";
import { AuthProvider } from "@/hooks/use-auth";
import { LoginPage } from "@/routes/login";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <LocationProvider>
        <CurrentRomProvider>
          <SaveStorageProvider>
            <EmulatorProvider>
              <GameOptionsProvider>
                <App>
                  <Router>
                    <Route default index component={HomePage} />
                    <Route path="/emulator" component={EmulatorPage} />
                    <Route path="/login" component={LoginPage} />
                  </Router>
                </App>
              </GameOptionsProvider>
            </EmulatorProvider>
          </SaveStorageProvider>
        </CurrentRomProvider>
      </LocationProvider>
    </AuthProvider>
  </StrictMode>,
);

registerServiceWorker();
