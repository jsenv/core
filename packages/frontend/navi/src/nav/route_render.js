import { createPubSub } from "@jsenv/dom";

/**
 * A container has put its page on screen — or as much of it as it can.
 *
 * A route matching is a signal changing, and the page it selects reaches the
 * DOM only once Preact has rendered — an unknown number of passes later, in an
 * unknown number of microtasks. Anyone who needs the page as it IS rather than
 * as it has been decided (a travel about to have its picture taken by the
 * browser, see route_travel.jsx) waits for this instead of counting.
 *
 * A page waiting on data is announced too, by the boundary showing its loading
 * state (see Loading in use_async_data.jsx): what the container could put on
 * screen is what the browser is about to take a picture of, and a page that
 * cannot render yet would otherwise be waited on until the transition dies of
 * it. It lives in a module of its own for that: the async layer says it as much
 * as the router does, and neither can import the other.
 */
const [publishRouteRender, observeRouteRender] = createPubSub();

export { observeRouteRender, publishRouteRender };
