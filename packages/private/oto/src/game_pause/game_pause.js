import { computed } from "@preact/signals";
import { pausedRoute } from "/routes.js";
import { documentHiddenSignal } from "/utils/document_visibility.js";

const gamePausedRouteIsActiveSignal = pausedRoute.isActiveSignal;
export const pauseGame = () => {
  pausedRoute.enter();
};
export const playGame = () => {
  pausedRoute.leave();
};
export const gamePausedSignal = computed(() => {
  const documentHidden = documentHiddenSignal.value;
  const gamePausedRouteIsActive = gamePausedRouteIsActiveSignal.value;
  return documentHidden || gamePausedRouteIsActive;
});
export const useGamePaused = () => gamePausedSignal.value;
