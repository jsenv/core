import { signal } from "@preact/signals"

import { paramsFromWindowName } from "./parent_window_context.js"
import { stateFromLocalStorage } from "./toolbar_state_context.js"

export const themeSignal = signal(
  typeof stateFromLocalStorage.theme === "string"
    ? stateFromLocalStorage.theme
    : typeof paramsFromWindowName.theme === "string"
    ? paramsFromWindowName.theme
    : "dark",
)
