import { useEffect, useState } from "react";

const MOBILE_VIEWPORT_QUERY = "(max-width: 767px)";

export const useViewportHeightVariable = (): void => {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const updateViewportHeight = () => {
      const viewportHeight =
        window.visualViewport?.height ??
        window.innerHeight ??
        document.documentElement.clientHeight;
      document.documentElement.style.setProperty(
        "--app-viewport-height",
        `${viewportHeight}px`,
      );
    };

    updateViewportHeight();

    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", updateViewportHeight);
    window.addEventListener("resize", updateViewportHeight);
    window.addEventListener("orientationchange", updateViewportHeight);
    document.addEventListener("fullscreenchange", updateViewportHeight);

    return () => {
      viewport?.removeEventListener("resize", updateViewportHeight);
      window.removeEventListener("resize", updateViewportHeight);
      window.removeEventListener("orientationchange", updateViewportHeight);
      document.removeEventListener("fullscreenchange", updateViewportHeight);
    };
  }, []);
};

export const useIsMobileViewport = (): boolean => {
  const getIsMobileViewport = () => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
  };

  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
    getIsMobileViewport(),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const query = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const updateViewportFlag = (
      event: MediaQueryList | MediaQueryListEvent,
    ) => {
      setIsMobileViewport(event.matches);
    };
    updateViewportFlag(query);
    query.addEventListener("change", updateViewportFlag);
    return () => {
      query.removeEventListener("change", updateViewportFlag);
    };
  }, []);

  return isMobileViewport;
};
