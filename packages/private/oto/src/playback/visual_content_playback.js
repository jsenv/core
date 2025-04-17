import { computed, signal } from "@preact/signals";
import { gamePausedSignal } from "oto/src/game_pause/game_pause.js";

export const innerVisualContentPlaybackIsPreventedSignal = signal(false);
export const visualContentPlaybackIsPreventedSignal = computed(() => {
  const gamePaused = gamePausedSignal.value;
  const innerVisualContentPlaybackIsPrevented =
    innerVisualContentPlaybackIsPreventedSignal.value;
  if (gamePaused) {
    return true;
  }
  if (innerVisualContentPlaybackIsPrevented) {
    return true;
  }
  return false;
});

export const useVisualContentPlaybackIsPrevented = () => {
  return visualContentPlaybackIsPreventedSignal.value;
};
export const preventVisualContentPlayback = () => {
  innerVisualContentPlaybackIsPreventedSignal.value = true;
};
export const allowVisualContentPlayback = () => {
  innerVisualContentPlaybackIsPreventedSignal.value = false;
};
