import { themeSignal } from "./theme_signals.js";

export const switchToLightTheme = () => {
  themeSignal.value = "light";
};

export const switchToDefaultTheme = () => {
  themeSignal.value = "dark";
};
