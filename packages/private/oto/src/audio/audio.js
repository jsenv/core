import { effect, signal } from "@preact/signals";
import {
  muteAllMusics,
  unmuteAllMusics,
} from "./music/music_global_controls.js";
import { muteAllSounds, unmuteAllSounds } from "./sound/sound.js";

const mutedLocalStorageItem = localStorage.getItem("muted");
const mutedFromLocalStorage =
  mutedLocalStorageItem === undefined
    ? false
    : JSON.parse(mutedLocalStorageItem);
export const mutedSignal = signal(mutedFromLocalStorage || false);
export const useMuted = () => {
  return mutedSignal.value;
};
export const mute = () => {
  mutedSignal.value = true;
};
export const unmute = () => {
  mutedSignal.value = false;
};
effect(() => {
  const muted = mutedSignal.value;
  if (muted) {
    muteAllMusics();
    muteAllSounds();
  } else {
    unmuteAllMusics();
    unmuteAllSounds();
  }
  localStorage.setItem("muted", JSON.stringify(muted));
});
