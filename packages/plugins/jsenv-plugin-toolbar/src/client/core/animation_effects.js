import { effect } from "@preact/signals";

import { animationsEnabledSignal } from "./animation_signals.js";

effect(() => {
  const animationsEnabled = animationsEnabledSignal.value;
  if (animationsEnabled) {
    document.documentElement.removeAttribute("data-animation-disabled");
  } else {
    document.documentElement.setAttribute("data-animation-disabled", "");
  }
});
