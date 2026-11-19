/**
 * Whether the render running now is the one putting a new page on screen.
 *
 * A layer drawn over the pages — a popup bound to the address, the slides
 * inside it — can open, close or change place in the very navigation that
 * replaces the page beneath it: a link inside the layer leads to another page
 * and the layer's weak params are dropped, a back to the page it was open over
 * brings them back. For the layer that is not a movement of its own: the page
 * changing IS the movement. A route transition already carries it, photographed
 * as furniture with the page it belongs to (transition_furniture.js), and with
 * no transition the page cuts and the layer cuts with it. Played on its own as
 * well, it moves twice — an entrance or an exit over a page sliding past, or
 * appearing at once.
 *
 * So whatever reacts to such a change in a render — a popup's open state, a
 * slide container's current slide — asks here whether that render carries a
 * page change, and if so arrives where it goes without travelling there.
 *
 * A page is what navi animates between (route_page.js): a route, and the
 * params telling apart branches of one route. Which routes match is decided by
 * the path alone, so a navigation that changes the path changes the page; one
 * that keeps it changes the page only where a param IS a page — and navi knows
 * those only through the relation or the RouteTravel row that names them, so
 * that is who says so. A search param a page merely reads is not one: writing
 * it is the page answering, and a layer opened by it (the `?settings` its door
 * pushes, the back button taking it out) moves on its own.
 *
 * The answer lasts until the render applying the navigation is over: the held
 * one when somebody photographs the change, Preact's own otherwise, over by the
 * next frame (see whenPageRendered). Asked from a layout effect it is exact; an
 * opening deferred past the commit takes the answer with it, read when the
 * effect ran.
 */

import { prefersReducedMotion } from "../utils/css_timing.js";
import { whenPageRendered } from "./rendering_hold.js";

let renderingPageChange = false;

export const notePageChange = () => {
  if (renderingPageChange) {
    return;
  }
  renderingPageChange = true;
  whenPageRendered(() => {
    renderingPageChange = false;
  });
};

export const isRenderingPageChange = () => renderingPageChange;

// A traversal the browser has shown moving already: a back swiped in Safari,
// where its own picture of the entry reached slid in under the finger
// (PopStateEvent.hasUAVisualTransition). Played again, the page left would come
// back to slide off a second time. For a layer it is the same as the page
// changing (see above): it lands where the address puts it. Noted by the
// integration as the traversal is announced, and lasting like the page change.
let renderingShownByBrowser = false;

export const noteShownByBrowser = () => {
  if (renderingShownByBrowser) {
    return;
  }
  renderingShownByBrowser = true;
  whenPageRendered(() => {
    renderingShownByBrowser = false;
  });
};

export const isRenderingShownByBrowser = () => renderingShownByBrowser;

/**
 * Whether navi may play a movement of its own for what is being rendered: a
 * route's transition, a row travelling to its page (RouteTravel), a slide
 * (SlideContainer). Not for someone who asked their system for less motion,
 * nor for a navigation the browser has shown moving already. The answer is the
 * one place this is decided; every movement asks it as it would start, and a
 * movement that may not play lands where it goes at once — what it would have
 * played is still what the navigation decided (a route's crossing is recorded
 * all the same, see route_transition.jsx).
 */
export const mayAnimateMovement = () =>
  !renderingShownByBrowser && !prefersReducedMotion();
