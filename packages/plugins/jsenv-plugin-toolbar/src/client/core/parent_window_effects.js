import {
  addExternalCommandCallback,
  sendEventToParent,
} from "./parent_window_actions.js";
import { animationsEnabledSignal } from "./animation_signals.js";
import { initToolbarUI } from "../ui/toolbar_ui.js";

addExternalCommandCallback("initToolbar", () => {
  // for the first render, force disable animations
  const animationsEnabled = animationsEnabledSignal.value;
  if (animationsEnabled) {
    animationsEnabledSignal.value = false;
  }
  initToolbarUI();
  if (animationsEnabled) {
    animationsEnabledSignal.value = true;
  }
});

sendEventToParent("toolbar_ready");
