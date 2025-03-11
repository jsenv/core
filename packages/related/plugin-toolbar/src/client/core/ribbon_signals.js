import { signal } from "@preact/signals";

import { stateFromLocalStorage } from "./toolbar_state_context.js";

export const ribbonDisplayedSignal = signal(
  typeof stateFromLocalStorage.ribbonDisplayed === "boolean"
    ? stateFromLocalStorage.ribbonDisplayed
    : true,
);
