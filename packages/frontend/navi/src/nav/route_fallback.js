/**
 * The page a <Route> container shows when none of its branches matched, given
 * a name.
 *
 * Every other branch of a container is a route, and a route is a thing one can
 * talk ABOUT from outside the tree: write a movement between two of them (see
 * route_transition.jsx), put one in a row (see route_travel.jsx), read whether
 * it is on screen. The fallback branch is the one page defined by an ABSENCE —
 * "an address none of these claim" — so it has no url pattern to be declared
 * from, and until it is named, nothing can be said about it.
 *
 *   const NOT_FOUND_PAGE = routeFallback();
 *   <Route fallback={NOT_FOUND_PAGE} element={NotFoundPage} />
 *   defineRouteTransition(null, NOT_FOUND_PAGE, "slide-x");
 *
 * The absence is of a PARTICULAR set of claims — the branches of the container
 * holding it — and that set is not knowable from the routes of the application:
 * a route matching every address is a normal thing to declare (a carrier for
 * search params and route actions the whole app shares), and it would answer
 * "something matched" everywhere. So the container fills it in from the
 * children it was written with (see collectBranches in route.jsx), and a
 * fallback no container holds claims nothing.
 *
 * That leaves what a container cannot see: the address its own subtree lives
 * under. A section owning its sub-router renders it several components below
 * the leaf that matched the section's prefix, and "none of these five matched"
 * is then true on every screen of the application. Such a fallback names the
 * route it is under, and answers only there:
 *
 *   const DASHBOARD_NOT_FOUND_PAGE = routeFallback(DASHBOARD_SECTION_ROUTE);
 */

import { computed, signal } from "@preact/signals";

import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import { pageIsCurrent } from "./route_page.js";

const routeFallbackPrivatePropertiesMap = new WeakMap();

/**
 * Names the fallback branch of a <Route> container, so relations can be
 * written about the page it shows and its `matchingSignal` read from anywhere.
 *
 * @param {object} [scopeRoute] - the route this container's subtree lives
 *   under, when the container is not the application's own router. Without it
 *   the fallback answers wherever its container is on screen.
 * @returns {object} pass it as `<Route fallback={...}>`.
 */
export const routeFallback = (scopeRoute) => {
  const pagesSignal = signal(null);
  const nothingMatches = () => {
    const pages = pagesSignal.value;
    if (!pages) {
      return false;
    }
    for (const page of pages) {
      if (pageIsCurrent(page)) {
        return false;
      }
    }
    return true;
  };
  const routeFallback = {
    isRouteFallback: true,
    scopeRoute,
    matchingSignal: scopeRoute
      ? computed(() => {
          if (!scopeRoute.matchingSignal.value) {
            return false;
          }
          return nothingMatches();
        })
      : computed(nothingMatches),
    toString: () => {
      if (scopeRoute) {
        return `route fallback under ${scopeRoute}`;
      }
      return `route fallback`;
    },
  };
  Object.preventExtensions(routeFallback);
  routeFallbackPrivatePropertiesMap.set(routeFallback, { pagesSignal });
  return routeFallback;
};

/**
 * The pages the fallback is the absence of, handed over by the container
 * holding it. Read as a signal rather than at render: a movement is decided
 * while rendering is held, before the container has had a chance to choose a
 * branch (see rendering_hold.js), so "we are on the fallback" has to be
 * answerable from the route signals alone.
 */
export const wireRouteFallback = (routeFallback, pages) => {
  const { pagesSignal } = routeFallbackPrivatePropertiesMap.get(routeFallback);
  const pagesCurrent = pagesSignal.peek();
  if (pagesCurrent && samePages(pagesCurrent, pages)) {
    return;
  }
  pagesSignal.value = pages;
};

export const unwireRouteFallback = (routeFallback) => {
  const { pagesSignal } = routeFallbackPrivatePropertiesMap.get(routeFallback);
  pagesSignal.value = null;
};

const samePages = (pages, otherPages) => {
  if (pages.length !== otherPages.length) {
    return false;
  }
  let i = 0;
  while (i < pages.length) {
    const page = pages[i];
    const otherPage = otherPages[i];
    if (page.route !== otherPage.route) {
      return false;
    }
    if (!compareTwoJsValues(page.params, otherPage.params)) {
      return false;
    }
    i++;
  }
  return true;
};
