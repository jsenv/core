import { applyRouting } from "./route.js";
import { setupRoutingViaHistory } from "./routing_via_history.js";
import { setupRoutingViaNavigation } from "./routing_via_navigation.js";

import { routingWhile } from "./document_routing_signal.js";

export let routingVia = "history";

const stuff = (...args) => {
  routingWhile(() => {
    return applyRouting(...args);
  });
};

const methods =
  routingVia === "history"
    ? setupRoutingViaHistory(stuff)
    : setupRoutingViaNavigation(stuff);

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
