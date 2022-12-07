import { signal } from "@preact/signals"

import { paramsFromWindowName } from "./parent_window_context.js"
import { stateFromLocalStorage } from "./toolbar_state_context.js"

export const animationsEnabledSignal = signal(
  typeof stateFromLocalStorage.animationsEnabled === "boolean"
    ? stateFromLocalStorage.animationsEnabled
    : typeof paramsFromWindowName.animationsEnabled === "boolean"
    ? paramsFromWindowName.animationsEnabled
    : false,
)
