const SERVICE_WORKER_PATH = "/sw.js";

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(SERVICE_WORKER_PATH)
      .then((registration) => {
        registration.update();
      })
      .catch((error) => {
        // Log but do not block the UI if registration fails.
        console.error("Failed to register service worker", error);
      });
  });
}
