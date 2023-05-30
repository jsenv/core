import { effect } from "@preact/signals";

import { ribbonDisplayedSignal } from "../../core/ribbon_signals.js";

const ribbonBox = document.querySelector("#ribbon_box");
const ribbonCheckbox = ribbonBox.querySelector("input");

export const renderToolbarRibbonSetting = () => {
  const ribbonContainer = window.parent.document.querySelector(
    "#jsenv_ribbon_container",
  );
  if (ribbonContainer) {
    ribbonBox.style.display = "block";
    effect(() => {
      const ribbonDisplayed = ribbonDisplayedSignal.value;
      ribbonCheckbox.checked = ribbonDisplayed;

      if (ribbonDisplayed) {
        ribbonContainer.style.display = "block";
      } else {
        ribbonContainer.style.display = "none";
      }
    });

    ribbonCheckbox.onchange = () => {
      if (ribbonCheckbox.checked) {
        ribbonDisplayedSignal.value = true;
      } else {
        ribbonDisplayedSignal.value = false;
      }
    };
  }
};
