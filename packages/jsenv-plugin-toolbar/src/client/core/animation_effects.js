import { effect } from "@preact/signals"

import { stateFromLocalStorage } from "./toolbar_state_context.js"
import { animationsEnabledSignal } from "./animation_signals.js"

if (stateFromLocalStorage.animationsEnabled) {
  animationsEnabledSignal.value = true
}
effect(() => {
  const animationsEnabled = animationsEnabledSignal.value
  if (animationsEnabled) {
    document.documentElement.removeAttribute("data-animation-disabled")
  } else {
    document.documentElement.setAttribute("data-animation-disabled", "")
  }
})
