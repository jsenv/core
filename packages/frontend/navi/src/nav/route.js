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
export const route = (pattern, { searchParams } = {}) => {
  const routePattern = createRoutePattern(pattern, { searchParams });
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
    route.navTo = (params) => {
      if (!integration) {
        if (import.meta.dev) {
          console.warn(`navTo called on "${route}" but integration not set`);
        }
        return Promise.resolve();
      }
      const routeUrl = route.buildUrl(params);
      return integration.navTo(routeUrl);
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
        // Check if this is a signal-originated call and there's a more specific route that will also handle it
        // If so, skip the redirect to avoid duplicate navTo calls
        if (isSignalChange) {
          return null;
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

      // This route is the most specific, handle the redirect ourselves
      // Check if the built URL pathname matches the current URL pathname.
      // When a catch-all route (e.g. "/") is the only match for a path like "/404",
      // buildUrl would produce "/?param=value" losing the current path.
      // In that case, preserve the current pathname and only update search params.
      // However, when buildMostPreciseUrl returns an ancestor URL (intentional shortening
      // because params are at defaults), we should trust that.
      // Distinguish the two cases by checking if builtPathname equals the route's own
      // literal base path (derived from cleanPattern). If yes → catch-all, preserve.
      // If no → ancestor optimization, let it through.
      const currentUrl = getUrl();
      if (currentUrl) {
        const builtUrl = route.buildUrl(newParams);
        const builtPathname = new URL(builtUrl).pathname;
        const currentPathname = new URL(currentUrl).pathname;
        if (builtPathname !== currentPathname) {
          const literalPatternPrefix = cleanPattern.split(":")[0];
          const ownBaseUrl = resolveRouteUrl(literalPatternPrefix);
          const ownBasePathname = new URL(ownBaseUrl).pathname;
          if (builtPathname === ownBasePathname) {
            if (DEBUG) {
              console.debug(
                `[${route}] Built URL pathname "${builtPathname}" is route's own base, current is "${currentPathname}", preserving current path`,
              );
            }
            const correctedUrl = new URL(currentUrl);
            correctedUrl.search = new URL(builtUrl).search;
            return integration.navTo(correctedUrl.href, {
              replace: true,
              callReason,
            });
          }
          if (DEBUG) {
            console.debug(
              `[${route}] Built URL pathname "${builtPathname}" differs from own base "${ownBasePathname}", ancestor optimization — letting through`,
            );
          }
        }
      }
      return route.redirectTo(newParams, {
        callReason,
      });
    };
    route.matchesParams = (providedParams) => {
      const currentParams = route.params;
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
    const { pathConnectionMap, queryConnectionMap } = routePattern;
    // important: keep this connectionMap after setup so that connectionMap correctly inherits parent pattern signals
    const connectionMap = new Map([
      ...pathConnectionMap,
      ...queryConnectionMap,
    ]);
    for (const [paramName, connection] of connectionMap) {
      const { signal: paramSignal, debug } = connection;
      if (debug) {
        console.debug(
          `[route] connecting url param "${paramName}" to signal`,
          paramSignal,
        );
      }
      // eslint-disable-next-line no-loop-func
      const cleanupSignalUrlEffect = effect(() => {
        const value = paramSignal.value;
        const rawParams = route.rawParamsSignal.value;
        const urlParamValue = rawParams[paramName];
        const matching = route.matchingSignal.value;

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

        if (value === urlParamValue) {
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

let setupRoutesCalled = false;
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
          const { pathConnectionMap, queryConnectionMap } = routePattern;
          const connectionMap = new Map([
            ...pathConnectionMap,
            ...queryConnectionMap,
          ]);

          for (const [paramName, connection] of connectionMap) {
            const { signal: paramSignal, debug } = connection;
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
                const otherRoutePrivateProperties =
                  getRoutePrivateProperties(otherRoute);

                // Check if this matching route extracts the parameter
                if (paramName in otherRawParams) {
                  parameterExtractedByMatchingRoute = true;
                }

                // Check if this matching route is in the same family using parent-child relationships
                const thisPatternObj = routePattern;
                const otherPatternObj =
                  otherRoutePrivateProperties.routePattern;

                // Routes are in same family if they share a hierarchical relationship:
                // 1. One is parent/ancestor of the other
                // 2. They share a common parent/ancestor
                let inSameFamily = false;

                // Check if other route is ancestor of this route
                let currentParent = thisPatternObj.parent;
                while (currentParent) {
                  if (currentParent === otherPatternObj) {
                    inSameFamily = true;
                    break;
                  }
                  currentParent = currentParent.parent;
                }

                // Check if this route is ancestor of other route
                if (!inSameFamily) {
                  currentParent = otherPatternObj.parent;
                  while (currentParent) {
                    if (currentParent === thisPatternObj) {
                      inSameFamily = true;
                      break;
                    }
                    currentParent = currentParent.parent;
                  }
                }

                // Check if they share a common parent (siblings or cousins)
                if (!inSameFamily) {
                  const thisAncestors = new Set();
                  currentParent = thisPatternObj.parent;
                  while (currentParent) {
                    thisAncestors.add(currentParent);
                    currentParent = currentParent.parent;
                  }

                  currentParent = otherPatternObj.parent;
                  while (currentParent) {
                    if (thisAncestors.has(currentParent)) {
                      inSameFamily = true;
                      break;
                    }
                    currentParent = currentParent.parent;
                  }
                }

                if (inSameFamily) {
                  matchingRouteInSameFamily = true;
                }
              }

              // Only reset signal if:
              // 1. We're navigating within the same route family (not to completely unrelated routes)
              // 2. AND no matching route extracts this parameter from URL
              // 3. AND parameter has no default value (making it truly optional)
              if (
                matchingRouteInSameFamily &&
                !parameterExtractedByMatchingRoute
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
            if (urlParamValue === value) {
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
  return {
    updateRoutes,
    clearRoutes: () => {
      for (const route of routeSet) {
        const routePrivateProperties = getRoutePrivateProperties(route);
        routePrivateProperties.cleanup();
        routePrivatePropertiesMap.delete(route);
      }
      routeSet.clear();
      setupRoutesCalled = false;
    },
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
