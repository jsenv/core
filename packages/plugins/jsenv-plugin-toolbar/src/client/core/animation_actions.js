import { animationsEnabledSignal } from "./animation_signals.js";

export const enableAnimations = () => {
  animationsEnabledSignal.value = true;
};
export const disableAnimations = () => {
  animationsEnabledSignal.value = false;
};
