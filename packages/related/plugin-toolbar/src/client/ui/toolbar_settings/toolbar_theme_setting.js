import {
  switchToDefaultTheme,
  switchToLightTheme,
} from "../../core/theme_actions.js";
import { themeSignal } from "../../core/theme_signals.js";

export const renderToolbarThemeSetting = () => {
  const checkbox = document.querySelector("#checkbox_dark_theme");
  checkbox.checked = themeSignal.value === "dark";
  checkbox.onchange = () => {
    if (checkbox.checked) {
      switchToDefaultTheme();
    } else {
      switchToLightTheme();
    }
  };
};
