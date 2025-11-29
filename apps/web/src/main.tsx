import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import App from "@/app";
import { registerServiceWorker } from "@/register-service-worker";
import { SaveStorageProvider } from "@/hooks/use-save-storage";
import { CurrentRomProvider } from "@/hooks/use-current-rom";
import { EmulatorProvider } from "@/hooks/use-emulator";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CurrentRomProvider>
      <SaveStorageProvider>
        <EmulatorProvider>
          <App />
        </EmulatorProvider>
      </SaveStorageProvider>
    </CurrentRomProvider>
  </StrictMode>,
);

registerServiceWorker();
