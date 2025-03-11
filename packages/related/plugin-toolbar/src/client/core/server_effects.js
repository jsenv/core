import { effect } from "@preact/signals";

import { openServerTooltip } from "./server_actions.js";
import { serverConnectionSignal } from "./server_signals.js";

effect(() => {
  const serverConnection = serverConnectionSignal.value;
  if (serverConnection === "connecting" || serverConnection === "closed") {
    openServerTooltip();
  }
});
