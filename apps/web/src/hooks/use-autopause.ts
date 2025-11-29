import { useEffect, useRef } from "react";

import { RuntimeClient } from "@gbemu/runtime";

import { useIsMobileDevice } from "@/hooks/use-is-mobile-device";

export const useAutopause = (phase: string, runtime: RuntimeClient | null) => {
  const isMobileDevice = useIsMobileDevice();
  const autoPauseRef = useRef(false);

  useEffect(() => {
    if (phase !== "running") {
      autoPauseRef.current = false;
    }
  }, [phase]);

  useEffect(() => {
    if (!isMobileDevice) {
      autoPauseRef.current = false;
      return;
    }
    const handleVisibilityChange = () => {
      if (!runtime) {
        return;
      }
      if (document.visibilityState === "hidden") {
        if (phase === "running") {
          autoPauseRef.current = true;
          void runtime.pause().catch((err: unknown) => {
            console.error(err);
          });
        }
        return;
      }
      if (
        document.visibilityState === "visible" &&
        phase === "running" &&
        autoPauseRef.current
      ) {
        autoPauseRef.current = false;
        void runtime.start().catch((err: unknown) => {
          console.error(err);
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isMobileDevice, phase, runtime]);
};
