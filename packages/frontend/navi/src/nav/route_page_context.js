import { createContext } from "preact";

/**
 * What a component can learn about the page it is rendered in, from the route
 * container rendering that page (see useContentKeepingLeavingPages in
 * route.jsx). `null` outside of any route container.
 *
 * - `isShown()` — whether the container would still show the page. False as
 *   soon as the address leads elsewhere: the page is about to be taken down, or
 *   hidden until the route transition leaving it is over, nothing it reads is
 *   worth a render any more, and nothing it holds speaks for the page shown (a
 *   list's hold on the document, see holdDocumentScroll). False for good once
 *   it is kept while leaving: a return to its route mounts the page anew. Asked
 *   outside any render — by a subscription deciding whether to re-render, by
 *   the scroll restoration when a position is due — and it reads the routes
 *   untracked, so asking subscribes nobody to them.
 * - `hasLeft()` — whether the page, or a page it sits in, is kept while leaving.
 *   Written by the container's render, before anything below it renders, and
 *   final. `isShown()` can answer false for a page that stays on screen (the
 *   address coming back, a container first rendered while the routes are
 *   frozen), so what cannot be undone asks this one.
 * - `leavingSignal` — true once the page, or a page it sits in, is hidden and
 *   kept while the movement plays: still mounted, so what it fills or moves
 *   outside its own nodes (a slot in a bar, the document a list scrolls) steps
 *   out rather than showing with, or moving, the page arriving. Every box of it
 *   measures 0×0 by then. Set after the render keeping the page, so that render
 *   and what it builds can only ask `hasLeft()`. Cleared by the render showing
 *   the page again, before anything below it renders: what mounts then never
 *   reads its page as leaving.
 */
export const RoutePageContext = createContext(null);
