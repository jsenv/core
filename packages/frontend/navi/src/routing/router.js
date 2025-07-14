import { applyRouting } from "./route.js";
import { setupRoutingViaHistory } from "./routing_via_history.js";
import { setupRoutingViaNavigation } from "./routing_via_navigation.js";

export let routingVia = "history";

const methods =
  routingVia === "history"
    ? setupRoutingViaHistory(applyRouting)
    : setupRoutingViaNavigation(applyRouting);

export const goTo = methods.goTo;
export const stopLoad = methods.stopLoad;
export const reload = methods.reload;
export const goBack = methods.goBack;
export const goForward = methods.goForward;
