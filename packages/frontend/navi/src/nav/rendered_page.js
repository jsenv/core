/**
 * The page the application's router shows, readable from outside the tree.
 *
 * Several routes can match one address — `/me` and `/me/games`, a carrier
 * route matching every address — and a container renders the first branch that
 * matches, in the order written, or its fallback. Which page that is belongs to
 * the containers: an app re-deriving it from the routes needs a copy of the
 * tree and a rule of its own for which match wins, and the copy misses the page
 * added last.
 *
 * So every container says what it shows once it has rendered it (the moment it
 * publishes its render, see route_render.js), and the page is followed from the
 * container rendered outside any other, down through the container rendered in
 * the page above it — a section owning its sub-router included — to the
 * deepest. Read from what the containers chose, not from the route signals: a
 * movement is decided from the routes before any container has rendered (see
 * route_fallback.js); this is what is on screen.
 */

import { computed, signal } from "@preact/signals";

import { compareTwoJsValues } from "../utils/compare_two_js_values.js";

// One entry per mounted container, in mount order: the page it renders its
// branch in — the parent page of the containers inside that branch — and
// what that branch is.
const shownByContainer = new Map();
const renderedPageWritableSignal = signal(undefined);

/**
 * `{ route, params }` of the page the router renders: the deepest leaf the
 * containers show, from the `<Route>` rendered outside any other down through
 * the sub-routers rendered inside its pages. `params` are the branch's
 * `routeParams` (undefined for a route on its own), as everywhere navi speaks
 * of a page — the address's values are the route's own signals. A fallback
 * branch gives its `routeFallback()` as `route`, `null` when it has no name.
 * `undefined` before the first page is rendered.
 *
 * During a route transition, the page arriving: the container renders it at
 * once, the page being left only stays hidden until the movement is over.
 *
 * ```js
 * const readScreenShown = () => {
 *   const page = renderedPageSignal.value;
 *   if (!page) {
 *     return null;
 *   }
 *   return page.route === NOT_FOUND_PAGE ? "404" : page.route.pattern;
 * };
 * ```
 */
export const renderedPageSignal = computed(() => {
  return renderedPageWritableSignal.value;
});

// `branchType` is "leaf", "fallback" or "container"; `routePage` the
// `{ route, params }` of a leaf or a fallback.
export const reportContainerShows = (
  containerKey,
  { parentPage, page, branchType, routePage },
) => {
  shownByContainer.set(containerKey, {
    parentPage,
    page,
    branchType,
    routePage,
  });
  scheduleWrite();
};

export const forgetContainer = (containerKey) => {
  shownByContainer.delete(containerKey);
  scheduleWrite();
};

// Once per commit: a container changing page takes down the containers of the
// page it leaves and mounts those of the page it arrives on, each reporting in
// its own layout effect, inner ones first. Read in between, the page would be
// the outer one's for a moment.
let writeQueued = false;
const scheduleWrite = () => {
  if (writeQueued) {
    return;
  }
  writeQueued = true;
  queueMicrotask(() => {
    writeQueued = false;
    writeRenderedPage();
  });
};

const writeRenderedPage = () => {
  let shown = findShownInside(null);
  if (!shown) {
    renderedPageWritableSignal.value = undefined;
    return;
  }
  while (shown.page) {
    const shownInside = findShownInside(shown.page);
    if (!shownInside) {
      break;
    }
    shown = shownInside;
  }
  if (!shown.branchType) {
    renderedPageWritableSignal.value = undefined;
    return;
  }
  if (shown.branchType === "container") {
    // Its container has not rendered yet (a <Loading> around it waiting): the
    // page is still the one it is about to take the place of.
    return;
  }
  const { routePage } = shown;
  const current = renderedPageWritableSignal.peek();
  if (
    current &&
    current.route === routePage.route &&
    compareTwoJsValues(current.params, routePage.params)
  ) {
    return;
  }
  renderedPageWritableSignal.value = routePage;
};

// A page holding two sub-routers side by side is followed into the first
// mounted.
const findShownInside = (parentPage) => {
  for (const shown of shownByContainer.values()) {
    if (shown.parentPage === parentPage) {
      return shown;
    }
  }
  return null;
};
