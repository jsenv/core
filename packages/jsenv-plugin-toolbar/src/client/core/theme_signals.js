import { signal } from "@preact/signals"

import { paramsFromParentWindow } from "./parent_window_context.js"
import { stateFromLocalStorage } from "./toolbar_state_context.js"

export const themeSignal = signal(
  typeof stateFromLocalStorage.theme === "string"
    ? stateFromLocalStorage.theme
    : typeof paramsFromParentWindow.theme === "string"
    ? paramsFromParentWindow.theme
    : "dark",
)
