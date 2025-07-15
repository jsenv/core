import { applyRouting } from "./routing.js";
import { setupRoutingViaHistory } from "./routing_via_history.js";
import { setupRoutingViaNavigation } from "./routing_via_navigation.js";

export let routingVia = "history";

const methods =
  routingVia === "history"
    ? setupRoutingViaHistory(applyRouting)
    : setupRoutingViaNavigation(applyRouting);

// TODO: should be called once route are registered
// and we'll likely register all route at once because it would create bug
// to have lazy loaded route as any route (url) can be accessed at any time by
// "definition" (a url can be shared, reloaded, etc)
methods.init();

export const goTo = methods.goTo;
export const stopLoad = methods.stopLoad;
export const reload = methods.reload;
export const goBack = methods.goBack;
export const goForward = methods.goForward;
export const handleTask = methods.handleTask;
