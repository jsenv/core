import { effect } from "@preact/signals";

import { serverConnectionSignal } from "./server_signals.js";
import { openServerTooltip } from "./server_actions.js";

effect(() => {
  const serverConnection = serverConnectionSignal.value;
  if (serverConnection === "connecting" || serverConnection === "closed") {
    openServerTooltip();
  }
});
