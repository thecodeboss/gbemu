import { useEffect, useState } from "react";

const detectIsMobileDevice = (): boolean => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const coarsePointer =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const ua = navigator.userAgent ?? "";
  const isMobileUa =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  return coarsePointer || isMobileUa;
};

export const useIsMobileDevice = (): boolean => {
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(() =>
    detectIsMobileDevice(),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const updateMobileDeviceFlag = () => {
      setIsMobileDevice(detectIsMobileDevice());
    };
    updateMobileDeviceFlag();
    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
    coarsePointerQuery.addEventListener("change", updateMobileDeviceFlag);
    return () => {
      coarsePointerQuery.removeEventListener("change", updateMobileDeviceFlag);
    };
  }, []);

  return isMobileDevice;
};
