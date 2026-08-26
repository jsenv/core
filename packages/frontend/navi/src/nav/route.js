/**
 * Route management with pattern-first architecture
 * Routes work with relative URLs, patterns handle base URL resolution
 */

import { createPubSub } from "@jsenv/dom";
import { batch, computed, effect, signal } from "@preact/signals";

import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import {
  createRoutePattern,
  resolveRouteUrl,
  setupRoutePatterns,
} from "./route_pattern.js";

const DEBUG = false;

const routePrivatePropertiesMap = new WeakMap();
const getRoutePrivateProperties = (route) => {
  return routePrivatePropertiesMap.get(route);
};
const ROUTE_NOT_MATCHING_PARAMS = {};
// Flag to prevent signal-to-URL synchronization during URL-to-signal synchronization
let isUpdatingRoutesFromUrl = false;
/**
 * Declares a route from an url pattern.
 *
 * @param {string} pattern - The url pattern, where `:name` is a path param and
 *   `:name=${signal}` binds that param to a signal.
 * @param {object} [options]
 * @param {Object<string, import("@preact/signals").Signal>} [options.searchParams]
 *   Search params this route two-way syncs with, by name.
 * @param {Object<string, RegExp | Array | ((value: string) => boolean)>} [options.params]
 *   Which values a path param accepts, by param name: a regexp tested against the
 *   decoded segment, the list of accepted values (compared as strings, so it can
 *   be the `oneOf` of the signal bound to that param), or a predicate. A route
 *   whose param declines the segment does not match at all: no signal is
 *   written, `<Route fallback>` is reachable, and `/:gameId` can sit at the root
 *   without swallowing `/cgu`. A constrained param is also required — no segment
 *   is not one of the values it accepts — so `/:gameId` does not match `/`.
 *
 *   Constrain the shape, not the existence: whether that game exists is for the
 *   route action and the page to answer, on a route that did match.
 *
 *   ```js
 *   route(`/:gameId=${gamePageIdSignal}`, { params: { gameId: /^W-[A-Z0-9]{8}$/i } });
 *   route(`/games/:section=${sectionSignal}`, { params: { section: SECTIONS } });
 *   ```
 * @param {object} [options.redirectRoute]
 *   This address only sends elsewhere: the route it resolves to. The
 *   redirection happens at the door of the navigation, so this address is never
 *   displayed, never enters the history, runs no route action and writes no
 *   signal — going back lands on the page before it, not on the redirection
 *   again. It fires on this route's own address only: a trailing slash still
 *   catches what lies below it for rendering, never for redirecting.
 *
 *   The params found in the url carry over to the ones the target route
 *   declares under the same name; what it cannot place is left behind.
 *
 *   ```js
 *   route("/", { redirectRoute: MY_GAMES_PAGE });
 *   // gameId carries over on its own, shareState is not a param of GAME_PAGE
 *   route("/:gameId/:shareState", { redirectRoute: GAME_PAGE });
 *   ```
 * @param {object|Function|null} [options.redirectRouteParams]
 *   What to change about the params carried over: an object, or a function of
 *   the params found in the url returning one. Written params win over inherited
 *   ones, `undefined` drops one, and `null` carries nothing over at all.
 *
 *   ```js
 *   route("/legacy/:id", { redirectRoute: GAME_PAGE, redirectRouteParams: ({ id }) => ({ gameId: id }) });
 *   route("/:gameId/invite", { redirectRoute: HOME_PAGE, redirectRouteParams: null });
 *   ```
 */
export const route = (
  pattern,
  { searchParams, params, redirectRoute, redirectRouteParams } = {},
) => {
  const routePattern = createRoutePattern(pattern, { searchParams, params });
  if (DEBUG) {
    console.debug(`Creating route: ${pattern}`);
  }
  const { cleanPattern } = routePattern;
  const [publishStatus, subscribeStatus] = createPubSub();

  // prepare route object
  const route = {
    urlPattern: cleanPattern,
    pattern: cleanPattern,
    isRoute: true,
    setupCalled: false,
    matching: false,
    params: ROUTE_NOT_MATCHING_PARAMS,
    buildUrl: null,
    relativeUrl: null,
    url: null,
    matchingSignal: signal(false),
    rawParamsSignal: signal(ROUTE_NOT_MATCHING_PARAMS),
    visited: false,
    visitedSignal: signal(false),
    paramsSignal: null,
    urlSignal: null,
    replaceParams: undefined,
    buildRelativeUrl: undefined,
    relativeUrlSignal: null,
    matchesParams: undefined,
    navTo: undefined,
    redirectTo: undefined,
    subscribeStatus,
    toString: () => {
      return `route "${cleanPattern}"`;
    },
  };
  Object.preventExtensions(route);

  // route private props
  const cleanupCallbackSet = new Set();
  const setupCallbackSet = new Set();
  const registerSetup = (callback) => {
    setupCallbackSet.add(callback);
  };
  route_private_properties: {
    const routePrivateProperties = {
      routePattern,
      redirectRoute,
      redirectRouteParams,
      setup: null,
      updateStatus: null,
      cleanup: null,
    };
    routePrivatePropertiesMap.set(route, routePrivateProperties);
    routePrivateProperties.cleanup = () => {
      for (const cleanupCallback of cleanupCallbackSet) {
        cleanupCallback();
      }
      cleanupCallbackSet.clear();
    };
    routePrivateProperties.updateStatus = ({ matching, params, visited }) => {
      let someChange = false;
      route.matchingSignal.value = matching;

      if (route.matching !== matching) {
        route.matching = matching;
        someChange = true;
      }
      route.visitedSignal.value = visited;
      if (route.visited !== visited) {
        route.visited = visited;
        someChange = true;
      }
      // Store raw params (from URL) - paramsSignal will reactively compute merged params
      route.rawParamsSignal.value = params;
      // Get merged params for comparison (computed signal will handle the merging)
      const mergedParams = route.paramsSignal.value;
      if (route.params !== mergedParams) {
        route.params = mergedParams;
        someChange = true;
      }
      if (!someChange) {
        return false;
      }
      if (DEBUG) {
        console.debug(`${route} status changed:`, {
          matching,
          params: mergedParams,
          visited,
        });
      }
      publishStatus({
        matching,
        params: mergedParams,
        visited,
      });
      return true;
    };
    // (for now data contains only { routeSet })
    routePrivateProperties.setup = (data) => {
      for (const setupCallback of setupCallbackSet) {
        const returnValue = setupCallback(data);
        if (typeof returnValue === "function") {
          cleanupCallbackSet.add(returnValue);
        }
      }
      setupCallbackSet.clear();
    };
  }

  registerSetup(() => {
    route.setupCalled = true;
  });
  // methods
  registerSetup(({ routeSet, getUrl }) => {
    route.buildRelativeUrl = (params) => {
      // buildMostPreciseUrl now handles parameter resolution internally
      return routePattern.buildMostPreciseUrl(params);
    };
    route.buildUrl = (params) => {
      const routeRelativeUrl = route.buildRelativeUrl(params);
      const routeUrl = resolveRouteUrl(routeRelativeUrl);
      return routeUrl;
    };
    // Options travel as they do to navTo() itself — `routeTransition` is the
    // one that matters here: what this one navigation asks of a route
    // transition (see route_transition.jsx), which is the programmatic half of
    // what a <Link routeTransition> says.
    route.navTo = (params, options) => {
      if (!integration) {
        if (import.meta.dev) {
          console.warn(`navTo called on "${route}" but integration not set`);
        }
        return Promise.resolve();
      }
      const routeUrl = route.buildUrl(params);
      return integration.navTo(routeUrl, options);
    };
    route.redirectTo = (params, { callReason } = {}) => {
      if (!integration) {
        if (import.meta.dev) {
          console.warn(
            `redirectTo called on "${route}" but integration not set`,
          );
        }
        return Promise.resolve();
      }
      const routeUrl = route.buildUrl(params);
      if (DEBUG) {
        console.debug(
          `${route}.redirectTo(${routeUrl}) (reason: ${callReason})`,
        );
      }
      return integration.navTo(routeUrl, {
        replace: true,
        callReason,
      });
    };
    route.replaceParams = (newParams, { callReason, isSignalChange } = {}) => {
      const matching = route.matchingSignal.peek();
      if (!matching) {
        console.warn(
          `Cannot replace params on route ${route} because it is not matching the current URL.`,
        );
        return null;
      }

      // Find all matching routes and update their actions, then delegate to most specific (deeper = more specific)
      let mostSpecificRoute = route;
      const routePrivateProperties = getRoutePrivateProperties(route);
      let maxDepth = routePrivateProperties.routePattern.depth;
      for (const routeCandidate of routeSet) {
        if (routeCandidate === route) {
          continue;
        }
        if (!routeCandidate.matching) {
          continue;
        }
        const matchingRoute = routeCandidate;
        const matchingRoutePrivateProperties =
          getRoutePrivateProperties(matchingRoute);
        const depth = matchingRoutePrivateProperties.routePattern.depth;
        if (depth > maxDepth) {
          maxDepth = depth;
          mostSpecificRoute = matchingRoute;
        }
      }
      const isMostSpecificRoute = mostSpecificRoute === route;

      if (DEBUG) {
        console.debug(
          `[${route}] Most specific route selected: ${mostSpecificRoute} (depth: ${maxDepth})`,
        );
        console.debug(
          `[${route}] Building URL with params:`,
          newParams,
          `on route ${mostSpecificRoute}`,
        );
      }

      // If we found a more specific route, delegate to it; otherwise handle it ourselves
      if (!isMostSpecificRoute) {
        // For signal-originated calls, only skip delegation if the more specific route
        // has its own signal connection for the same params — meaning its own effect will
        // fire and handle the redirect. If it doesn't have the connection, the signal
        // change would be silently dropped, so we must delegate anyway.
        if (isSignalChange) {
          const mostSpecificRoutePrivateProperties =
            getRoutePrivateProperties(mostSpecificRoute);
          const { pathConnectionMap, queryConnectionMap } =
            mostSpecificRoutePrivateProperties.routePattern;
          const willHandleItself = Object.keys(newParams).every(
            (paramName) =>
              pathConnectionMap.has(paramName) ||
              queryConnectionMap.has(paramName),
          );
          if (willHandleItself) {
            return null;
          }
        }
        if (DEBUG) {
          console.debug(
            `${route} delegating redirect to more specific route ${mostSpecificRoute}`,
          );
        }
        return mostSpecificRoute.redirectTo(newParams, {
          callReason: `replaceParams delegation from ${route} to ${mostSpecificRoute} (original reason: ${callReason})`,
        });
      }

      // This route is the most specific — compute the target URL.
      // buildUrlPreservingPath handles the catch-all case where this trailing-slash
      // route matched a path it cannot represent (e.g. "/" on "/404") without
      // corrupting the current URL.  Ancestor optimisation is trusted as-is.
      if (!integration) {
        if (import.meta.dev) {
          console.warn(
            `redirectTo called on "${route}" but integration not set`,
          );
        }
        return Promise.resolve();
      }
      const targetUrl = routePattern.buildUrlPreservingPath(
        getUrl(),
        newParams,
      );
      if (DEBUG) {
        console.debug(
          `[${route}] navigating to ${targetUrl} (reason: ${callReason})`,
        );
      }
      return integration.navTo(targetUrl, {
        replace: true,
        callReason,
      });
    };
    route.matchesParams = (providedParams) => {
      // paramsSignal (not route.params) so a component calling this during render
      // subscribes to param changes: a navigation from /games/me/a to /games/me/b
      // leaves matchingSignal untouched, only the params change.
      const currentParams = route.paramsSignal.value;
      const resolvedParams = routePattern.resolveParams({
        ...currentParams,
        ...providedParams,
      });
      const same = compareTwoJsValues(currentParams, resolvedParams);
      return same;
    };
  });
  // relativeUrl/url
  registerSetup(() => {
    route.relativeUrlSignal = computed(() => {
      const rawParams = route.rawParamsSignal.value;
      const relativeUrl = route.buildRelativeUrl(rawParams);
      return relativeUrl;
    });
    route.urlSignal = computed(() => {
      const routeUrl = route.buildUrl();
      return routeUrl;
    });
    const cleanupRelativeUrlSignalEffect = effect(() => {
      const routeRelativeUrl = route.relativeUrlSignal.value;
      route.relativeUrl = routeRelativeUrl;
    });
    const cleanupUrlSignalEffect = effect(() => {
      const routeUrl = route.urlSignal.value;
      route.url = routeUrl;
    });
    return () => {
      cleanupRelativeUrlSignalEffect();
      cleanupUrlSignalEffect();
    };
  });
  // params
  registerSetup(() => {
    route.paramsSignal = computed(() => {
      const rawParams = route.rawParamsSignal.value;
      const resolvedParams = routePattern.resolveParams(rawParams);
      return resolvedParams;
    });

    // Keep route.params synchronized with paramsSignal
    // Doing this with the signal instead of in the updateStatus function ensures route.params includes parameters from child routes
    const cleanupParamsSignalEffect = effect(() => {
      const params = route.paramsSignal.value;
      if (route.params !== params) {
        route.params = params;
      }
    });

    return () => {
      cleanupParamsSignalEffect();
    };
  });
  // Signal -> URL sync: When signal changes, update URL to reflect meaningful state
  // Only sync non-default values to keep URLs clean (static fallbacks stay invisible)
  registerSetup(() => {
    const cleanupSignalUrlEffectSet = new Set();
    // important: read connections at setup time so it includes query connections
    // inherited from ancestor patterns
    const { connections } = routePattern;
    for (const connection of connections) {
      const { signal: paramSignal, debug, paramName } = connection;
      if (debug) {
        console.debug(
          `[route] connecting url param "${paramName}" to signal`,
          paramSignal,
        );
      }
      // eslint-disable-next-line no-loop-func
      const cleanupSignalUrlEffect = effect(() => {
        const value = paramSignal.value;
        // Use peek() to avoid subscribing to URL-derived signals.
        // This effect should only re-run when the param signal changes,
        // not when the URL changes (which would create a cycle: signal→URL→signal).
        const rawParams = route.rawParamsSignal.peek();
        const urlParamValue = rawParams[paramName];
        const matching = route.matchingSignal.peek();

        // Signal returned to default - clean up URL by removing the parameter
        // Skip cleanup during URL-to-signal synchronization to prevent recursion
        if (isUpdatingRoutesFromUrl) {
          return;
        }

        if (!matching) {
          // Route not matching, no URL sync needed
          return;
        }
        if (urlParamValue === undefined) {
          // No URL parameter exists - check if signal has meaningful value to add
          if (connection.isDefaultValue(value)) {
            // Signal using default value, keep URL clean (no parameter needed)
            return;
          }
          if (debug) {
            console.debug(
              `[route] Signal->URL: ${paramName} adding custom value ${value} to URL (default: ${connection.getDefaultValue()})`,
            );
          }
          route.replaceParams(
            { [paramName]: value },
            {
              callReason: `${paramName} signal change on ${route}`,
              isSignalChange: true,
            },
          );
          return;
        }

        // URL parameter exists - check if we need to update or clean it up
        if (connection.isDefaultValue(value)) {
          if (debug) {
            console.debug(
              `[route] Signal->URL: ${paramName} cleaning URL (removing default value ${value})`,
            );
          }
          route.replaceParams(
            { [paramName]: undefined },
            {
              callReason: `${paramName} signal reset to default on ${route}`,
              isSignalChange: true,
            },
          );
          return;
        }

        if (compareTwoJsValues(value, urlParamValue)) {
          // Values already match, no sync needed
          return;
        }
        if (debug) {
          console.debug(
            `[route] Signal->URL: ${paramName} updating URL ${urlParamValue} -> ${value}`,
          );
        }
        route.replaceParams(
          { [paramName]: value },
          {
            callReason: `${paramName} signal change on ${route}`,
            isSignalChange: true,
          },
        );
      });
      cleanupSignalUrlEffectSet.add(cleanupSignalUrlEffect);
    }
    return () => {
      for (const cleanupSignalUrlEffect of cleanupSignalUrlEffectSet) {
        cleanupSignalUrlEffect();
      }
    };
  });

  return route;
};

const [publishRouteMutations, observeRouteMutations] = createPubSub();
export { observeRouteMutations };

let redirectingRouteSet = null;
/**
 * Where does this url really lead?
 *
 * Asked at the door of every navigation, before the url is written anywhere —
 * an address that only sends elsewhere must not become a page, an entry in the
 * history, or a route anything can see matching. Answered without reading a
 * single signal: the url alone says it.
 *
 * The chain is followed here rather than by letting each redirection navigate
 * in turn, so one navigation happens and the addresses in between leave no
 * trace at all.
 *
 * @param {string} url
 * @returns {string|null} The url to go to instead, or null.
 */
export const resolveRouteRedirection = (url) => {
  if (!redirectingRouteSet || redirectingRouteSet.size === 0) {
    return null;
  }
  let urlToResolve = url;
  let redirectionUrl = null;
  const urlChain = [url];
  while (true) {
    const nextUrl = resolveRedirectionOnce(urlToResolve);
    if (!nextUrl || nextUrl === urlToResolve) {
      break;
    }
    if (urlChain.includes(nextUrl)) {
      throw new Error(
        `Redirection cycle: ${[...urlChain, nextUrl].join(" -> ")}`,
      );
    }
    urlChain.push(nextUrl);
    redirectionUrl = nextUrl;
    urlToResolve = nextUrl;
  }
  return redirectionUrl;
};
const resolveRedirectionOnce = (url) => {
  let redirectingRoute = null;
  let redirectingRouteParams = null;
  let maxDepth = -1;
  for (const route of redirectingRouteSet) {
    const { routePattern } = getRoutePrivateProperties(route);
    // exact: what a trailing slash catches is what a container renders, not
    // what an address redirects — "/" redirecting must not take "/cgu" with it
    const urlParams = routePattern.applyOn(url, { exact: true });
    if (!urlParams) {
      continue;
    }
    // Deeper = more specific, the reading the whole router shares (see
    // replaceParams): "/:gameId/invite" is a child of "/:gameId/:shareState",
    // so it answers for an url both of them match.
    if (routePattern.depth > maxDepth) {
      maxDepth = routePattern.depth;
      redirectingRoute = route;
      redirectingRouteParams = urlParams;
    }
  }
  if (!redirectingRoute) {
    return null;
  }
  return buildRedirectionUrl(redirectingRoute, redirectingRouteParams);
};
const buildRedirectionUrl = (route, urlParams) => {
  const { redirectRoute, redirectRouteParams } =
    getRoutePrivateProperties(route);
  const paramsCarriedOver =
    redirectRouteParams === null
      ? {}
      : paramsTargetCanPlace(redirectRoute, urlParams);
  if (!redirectRouteParams) {
    return redirectRoute.buildUrl(paramsCarriedOver);
  }
  const paramsWritten =
    typeof redirectRouteParams === "function"
      ? redirectRouteParams(urlParams)
      : redirectRouteParams;
  // A param written as undefined is a param dropped: `paramName in params` is
  // what tells a url build "this one is decided", value included (resolveParams)
  return redirectRoute.buildUrl({ ...paramsCarriedOver, ...paramsWritten });
};

/**
 * The params of the url being left that the target route can put somewhere:
 * its own path segments and the search params it declares. What it cannot
 * place would otherwise be appended to the url as a query param, and a share
 * link resolving to "/W-ABC234PQ?shareState=1" is not the address anyone meant.
 */
const paramsTargetCanPlace = (redirectRoute, urlParams) => {
  const { routePattern } = getRoutePrivateProperties(redirectRoute);
  const { parsedPattern, queryConnectionMap } = routePattern;
  const paramsCarriedOver = {};
  for (const paramName of Object.keys(urlParams)) {
    const canPlace =
      queryConnectionMap.has(paramName) ||
      parsedPattern.segments.some(
        (segment) => segment.type === "param" && segment.name === paramName,
      );
    if (canPlace) {
      paramsCarriedOver[paramName] = urlParams[paramName];
    }
  }
  return paramsCarriedOver;
};

let setupRoutesCalled = false;
let activeCleanup = null;
export const setupRoutes = (routes) => {
  if (setupRoutesCalled) {
    throw new Error(
      `There is an active set of routes already.
Some code called setupRoutes before and did not properly cleanup routes with clearRoutes().
This prevents cross-test pollution and ensures clean state.`,
    );
  }
  setupRoutesCalled = true;

  const routeSet = new Set();
  let currentUrl = null;
  const getUrl = () => currentUrl;
  // PHASE 1: Setup patterns with unified objects (includes all relationships and signal connections)
  const routePatterns = [];
  for (const route of routes) {
    const { routePattern } = getRoutePrivateProperties(route);
    routePatterns.push(routePattern);
    routeSet.add(route);
  }
  setupRoutePatterns(routePatterns);

  // Setup routes now that patterns are correctly initialized
  for (const route of routeSet) {
    const { setup } = getRoutePrivateProperties(route);
    setup({ routeSet, getUrl });
  }

  // Checked here rather than at declaration: a route may redirect to one
  // declared after it, and reading the target then would forbid that order.
  redirectingRouteSet = new Set();
  for (const route of routeSet) {
    const { redirectRoute } = getRoutePrivateProperties(route);
    if (!redirectRoute) {
      continue;
    }
    if (!redirectRoute.isRoute) {
      throw new TypeError(
        `${route} redirects to ${redirectRoute}, expecting a route object`,
      );
    }
    redirectingRouteSet.add(route);
  }

  // Store previous route states to detect changes
  const routePreviousStateMap = new WeakMap();
  const updateRoutes = (
    url,
    {
      isVisited = () => false,
      // state
    } = {},
  ) => {
    currentUrl = url;
    const returnValue = {};
    const routeMatchInfoSet = new Set();
    for (const route of routeSet) {
      const routePrivateProperties = getRoutePrivateProperties(route);
      const { routePattern } = routePrivateProperties;

      const previousState = routePreviousStateMap.get(route) || {
        matching: false,
        params: ROUTE_NOT_MATCHING_PARAMS,
        actionParams: ROUTE_NOT_MATCHING_PARAMS,
      };
      const oldMatching = previousState.matching;
      const oldParams = previousState.params;
      const oldActionParams = previousState.actionParams;

      let extractedParams = routePattern.applyOn(url);
      let newMatching = Boolean(extractedParams);
      let newParams;
      if (extractedParams) {
        if (compareTwoJsValues(oldParams, extractedParams)) {
          // No change in parameters, keep the old params
          newParams = oldParams;
        } else {
          newParams = extractedParams;
        }
      } else {
        newParams = ROUTE_NOT_MATCHING_PARAMS;
      }

      const routeMatchInfo = {
        route,
        routePrivateProperties,
        oldMatching,
        newMatching,
        oldParams,
        newParams,
        oldActionParams,
      };
      routeMatchInfoSet.add(routeMatchInfo);
      // Store current state for next comparison
      routePreviousStateMap.set(route, {
        matching: newMatching,
        params: newParams,
        actionParams: oldActionParams, // updated to newActionParams in update_route_actions
      });
    }

    sync_routes_with_url: {
      // URL -> Signal synchronization (moved from individual route effects to eliminate circular dependency)
      // Prevent signal-to-URL synchronization during URL-to-signal synchronization
      isUpdatingRoutesFromUrl = true;
      // Apply all signal updates in a batch
      const matchingRouteSet = new Set();
      const routeUpdateSet = new Set();
      batch(() => {
        for (const {
          route,
          routePrivateProperties,
          newMatching,
          newParams,
        } of routeMatchInfoSet) {
          const { updateStatus } = routePrivateProperties;
          const visited = isVisited(route.url);
          const updated = updateStatus({
            matching: newMatching,
            params: newParams,
            visited,
          });
          if (updated) {
            routeUpdateSet.add(route);
          }
          if (newMatching) {
            matchingRouteSet.add(route);
          }
        }

        for (const {
          route,
          routePrivateProperties,
          newMatching,
        } of routeMatchInfoSet) {
          const { routePattern } = routePrivateProperties;
          const { pathConnectionMap, queryConnectionMap, connections } =
            routePattern;

          for (const connection of connections) {
            const { signal: paramSignal, debug, paramName } = connection;
            const rawParams = route.rawParamsSignal.value;
            const urlParamValue = rawParams[paramName];

            if (!newMatching) {
              // Route doesn't match - check if any matching route extracts this parameter
              let parameterExtractedByMatchingRoute = false;
              let matchingRouteInSameFamily = false;

              for (const otherRoute of routeSet) {
                if (otherRoute === route || !otherRoute.matching) {
                  continue;
                }
                const otherRawParams = otherRoute.rawParamsSignal.value;

                // Check if this matching route extracts the parameter
                if (paramName in otherRawParams) {
                  parameterExtractedByMatchingRoute = true;
                }

                // Same family = same topmost ancestor
                // (familyRoot, computed in setupRoutePatterns)
                const otherPatternObj =
                  getRoutePrivateProperties(otherRoute).routePattern;
                if (otherPatternObj.familyRoot === routePattern.familyRoot) {
                  matchingRouteInSameFamily = true;
                }
              }

              // A weak param qualifies one visit: leaving the route ends it,
              // whatever the family and whatever the default. Coming back by a
              // url that does not carry the param comes back to a blank screen.
              if (connection.weak) {
                if (!parameterExtractedByMatchingRoute) {
                  const defaultValue = connection.getDefaultValue();
                  if (debug) {
                    console.debug(
                      `[route] weak param ${paramName}: route no longer matching, back to ${defaultValue}`,
                    );
                  }
                  paramSignal.value = defaultValue;
                }
                continue;
              }

              // Only reset signal if:
              // 1. We're navigating within the same route family (not to completely unrelated routes)
              // 2. AND no matching route extracts this parameter from URL
              // 3. AND parameter has no default value (making it truly optional)
              // 4. AND parameter is a path segment (not a search param)
              //    Search params represent user preferences/choices and must survive
              //    navigation away — only path segments are explicitly removed from
              //    the URL when the route stops matching.
              if (
                matchingRouteInSameFamily &&
                !parameterExtractedByMatchingRoute &&
                pathConnectionMap.has(paramName)
              ) {
                const defaultValue = connection.getDefaultValue();
                if (defaultValue === undefined) {
                  // Parameter is not extracted within same family and has no default - reset it
                  if (debug) {
                    console.debug(
                      `[route] Same family navigation, ${paramName} not extracted and has no default: resetting signal`,
                    );
                  }
                  paramSignal.value = undefined;
                } else if (debug) {
                  // Parameter has a default value - preserve current signal value
                  console.debug(
                    `[route] Parameter ${paramName} has default value ${defaultValue}: preserving signal value: ${paramSignal.value}`,
                  );
                }
              } else if (debug) {
                if (!matchingRouteInSameFamily) {
                  console.debug(
                    `[route] Different route family: preserving ${paramName} signal value: ${paramSignal.value}`,
                  );
                } else if (queryConnectionMap.has(paramName)) {
                  console.debug(
                    `[route] Search param ${paramName}: preserving signal value (user choice): ${paramSignal.value}`,
                  );
                } else {
                  console.debug(
                    `[route] Parameter ${paramName} extracted by matching route: preserving signal value: ${paramSignal.value}`,
                  );
                }
              }
              continue;
            }

            // URL -> Signal sync: When route matches, ensure signal matches URL state
            // URL is the source of truth for explicit parameters
            const value = paramSignal.peek();
            if (urlParamValue === undefined) {
              // No URL parameter - reset signal to its current default value
              // (handles both static fallback and dynamic default cases)
              const defaultValue = connection.getDefaultValue();
              if (connection.isDefaultValue(value)) {
                // Signal already has correct default value, no sync needed
                continue;
              }
              if (debug) {
                console.debug(
                  `[route] URL->Signal: ${paramName} not in URL, reset signal to default (${defaultValue})`,
                );
              }
              paramSignal.value = defaultValue;
              continue;
            }
            if (compareTwoJsValues(urlParamValue, value)) {
              // Values already match, no sync needed
              continue;
            }
            if (debug) {
              console.debug(
                `[route] URL->Signal: ${paramName}=${urlParamValue} in url, sync signal with url`,
              );
            }
            paramSignal.value = urlParamValue;
            continue;
          }
        }
      });
      if (routeUpdateSet.size > 0) {
        publishRouteMutations(routeUpdateSet);
      }
      // Reset flag after URL -> Signal synchronization is complete
      isUpdatingRoutesFromUrl = false;
      Object.assign(returnValue, { matchingRouteSet });
    }

    return returnValue;
  };

  // notify all routes are now ready (signals are initialized and patterns are set up) so integrations can safely read route state
  // and call updateRoutes
  onAllRouteReady(updateRoutes);

  // for unit test purposes code can call updateRoutes and clearRoutes
  const clearRoutes = () => {
    for (const route of routeSet) {
      const routePrivateProperties = getRoutePrivateProperties(route);
      routePrivateProperties.cleanup();
      routePrivatePropertiesMap.delete(route);
    }
    routeSet.clear();
    redirectingRouteSet = null;
    setupRoutesCalled = false;
    activeCleanup = null;
  };
  activeCleanup = clearRoutes;
  return {
    updateRoutes,
    clearRoutes,
  };
};

export const useRouteStatus = (route) => {
  if (import.meta.dev && (!route || !route.isRoute)) {
    throw new TypeError(
      `useRouteStatus() requires a route object, but received ${route}.`,
    );
  }
  const { urlSignal, matchingSignal, paramsSignal, visitedSignal } = route;
  const url = urlSignal.value;
  const matching = matchingSignal.value;
  const params = paramsSignal.value;
  const visited = visitedSignal.value;

  return {
    url,
    matching,
    params,
    visited,
  };
};

export const assertRoute = (route) => {
  if (!route.isRoute) {
    throw new Error(
      "The route prop must be a route object created with createRoute",
    );
  }
  if (!setupRoutesCalled) {
    throw new Error("setupRoutes() was not called");
  }
  if (!route.setupCalled) {
    throw new Error("The route was not passed to setupRoutes()");
  }
};

let integration;
export const setRouteIntegration = (integrationInterface) => {
  integration = integrationInterface;
};
let onAllRouteReady = () => {};
export const setOnAllRouteReady = (callback) => {
  onAllRouteReady = callback;
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (activeCleanup) {
      activeCleanup();
    }
  });
}
