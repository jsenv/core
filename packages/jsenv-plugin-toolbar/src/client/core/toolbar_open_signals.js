import { signal } from "@preact/signals";

import { paramsFromParentWindow } from "./parent_window_context.js";
import { stateFromLocalStorage } from "./toolbar_state_context.js";

export const openedSignal = signal(
  typeof stateFromLocalStorage.opened === "boolean"
    ? stateFromLocalStorage.opened
    : typeof paramsFromParentWindow.opened === "boolean"
    ? paramsFromParentWindow.opened
    : false,
);
