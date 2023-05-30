import { settingsOpenedSignal } from "./settings_signals.js";

export const openSettings = () => {
  settingsOpenedSignal.value = true;
};

export const closeSettings = () => {
  settingsOpenedSignal.value = false;
};
