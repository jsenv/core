import { effect } from "@preact/signals";

import {
  disableAnimations,
  enableAnimations,
} from "../../core/animation_actions.js";
import { animationsEnabledSignal } from "../../core/animation_signals.js";

export const renderToolbarAnimationSetting = () => {
  const animCheckbox = document.querySelector("#toggle_anims");

  effect(() => {
    const animationsEnabled = animationsEnabledSignal.value;
    animCheckbox.checked = animationsEnabled;
  });
  animCheckbox.onchange = () => {
    if (animCheckbox.checked) {
      enableAnimations();
    } else {
      disableAnimations();
    }
  };
  // enable toolbar transition only after first render
  setTimeout(() => {
    document.querySelector("#toolbar").setAttribute("data-animate", "");
  });
};
