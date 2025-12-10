import { lazy } from "react";

export const GameOptionsDialogLazy = lazy(() =>
  import("@/components/game-options-dialog").then((module) => ({
    default: module.GameOptionsDialog,
  })),
);

// eslint-disable-next-line react-refresh/only-export-components
export const preloadGameOptionsDialog = (): void => {
  void import("@/components/game-options-dialog");
};
