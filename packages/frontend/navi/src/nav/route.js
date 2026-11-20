/**
 * Route management with pattern-first architecture
 * Routes work with relative URLs, patterns handle base URL resolution
 */

import { computed, effect, signal, untracked } from "@preact/signals";

import { answerAsIf, writeStateFromAddress } from "../state/state_signal.js";
import { batchWithEffectErrorsApart } from "../utils/batch_with_effect_errors_apart.js";
import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import { warnUnknownOptions } from "../utils/warn_unknown_options.js";
import { amendSearch } from "./amend_search.js";
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
const ROUTE_OPTIONS = new Set([
  "searchParams",
  "params",
  "redirectRoute",
  "redirectRouteParams",
  "dropSearchParams",
]);
/**
 * Declares a route from an url pattern.
 *
 * @param {string} pattern - The url pattern, where `:name` is a path param and
 *   `:name=${signal}` binds that param to a signal. A param is required: the
 *   address may stop before it only when it is written `:name?` (`:name?=${signal}`)
 *   or has a default (see docs/navigation.md, "Which values a param accepts").
 *   A pattern ending in `/` is a frame: it matches every address below it too,
 *   and its search params hold there (see docs/navigation.md, "A page or a
 *   frame: the trailing slash").
 * @param {object} [options]
 * @param {Object<string, import("@preact/signals").Signal | {signal: import("@preact/signals").Signal, default?: any}>} [options.searchParams]
 *   Search params this route two-way syncs with, by name. The signal and the url
 *   are the same state: writing the signal rewrites the address, an address
 *   arriving from outside writes the signal, and the param disappears from the
 *   url while the signal holds its default.
 *   They exist on this route's address only, unless the pattern is a frame
 *   (`/map/`, `/map/*`, the root): then on every address below it too.
 *   `/places` does not lend its `?q=` to `/places/clubs`.
 *   `{ signal, default }` says what that state is worth ON THIS ROUTE: the same
 *   step opens a creation wizard on its first question and an edition one on
 *   its summary, each address staying clean on the step its page opens on. One
 *   state, and the page one is on decides where it starts — of the matching
 *   routes declaring it, the most specific one, whatever the order given to
 *   setupRoutes. It is said here rather than as a dynamic default on the
 *   signal because a signal and the route declaring it cannot name each other.
 *   Declare that state `weak`, or a link to one page built on the other
 *   carries the value it holds there (`/alerts/create?step=recap`).
 *   Writing one changes that param alone: the other pairs of the address,
 *   another route's or none's (`utm_source`), stay as they were written.
 *   Writing one AMENDS the history entry one is on — a param qualifies the
 *   screen, it is not a place, and one entry per write turns a single
 *   back-press into as many as the user moved. A state whose values ARE places
 *   says so where it is declared (`stateSignal(v, { history: "push" })`), and
 *   one write can still say otherwise (`signal.set(v, { history })`).
 * @param {Object<string, RegExp | Array | ((value: string) => boolean)>} [options.params]
 *   Which values a path param accepts, by param name: a regexp tested against the
 *   decoded segment, the list of accepted values (compared as strings, so it can
 *   be the `oneOf` of the signal bound to that param), or a predicate. A route
 *   whose param declines the segment does not match at all: no signal is
 *   written, `<Route fallback>` is reachable, and `/:gameId` can sit at the root
 *   without swallowing `/cgu`.
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
 * @param {string[]} [options.dropSearchParams]
 *   Search params this route's address never keeps: read by whoever fetched
 *   the address (a link preview crawler, a cache), never by the app. When this
 *   route's own address arrives carrying one, the navigation goes to the same
 *   address without it, at the door, like a redirection: no history entry, no
 *   route action, no signal written. Every other search param stays as written.
 *
 *   ```js
 *   // ?v= makes WhatsApp fetch a new preview, the address bar never shows it
 *   route(`/games/:gameId=${gamePageIdSignal}`, { dropSearchParams: ["v"] });
 *   ```
 */
export const route = (pattern, options = {}) => {
  const {
    searchParams,
    params,
    redirectRoute,
    redirectRouteParams,
    dropSearchParams,
  } = options;
  if (import.meta.dev) {
    warnUnknownOptions(`route("${pattern}")`, options, ROUTE_OPTIONS);
  }
  const routePattern = createRoutePattern(pattern, { searchParams, params });
  if (DEBUG) {
    console.debug(`Creating route: ${pattern}`);
  }
  const { cleanPattern } = routePattern;

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
    // Read as at the address a preload is for (see statesAt).
    matchingSignal: answerAsIf(signal(false)),
    rawParamsSignal: answerAsIf(signal(ROUTE_NOT_MATCHING_PARAMS)),
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
    preload: undefined,
    toString: () => {
      return `route "${cleanPattern}"`;
    },
  };
  /**
   * Asks ahead of the arrival for what this route's actions will ask: the
   * instances the arrival promotes to runs (see prerunAhead in route_action.js).
   *
   * Without params, only what asks nothing of the address: the page's code, a
   * read without params — what a link preloads, since it has no state to read
   * the params of. Given params, `{}` included, the address `buildUrl(params)`
   * leads to: every route action of this route reads its params as if the
   * route matched there — this route's `paramsSignal` and `matchingSignal`, and
   * its states (see statesAt). Another route reads what it holds now.
   *
   * @param {object} [params]
   */
  route.preload = (params) => {
    const preloadSet = routePreloadMap.get(route);
    if (preloadSet) {
      for (const preload of preloadSet) {
        preload();
      }
    }
    if (params === undefined) {
      return;
    }
    const statePreloadSet = routeStatePreloadMap.get(route);
    if (!statePreloadSet) {
      return;
    }
    const values = statesAt(route, params);
    for (const preload of statePreloadSet) {
      preload(values);
    }
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
      dropSearchParams,
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
      if (DEBUG && someChange) {
        console.debug(`${route} status changed:`, {
          matching,
          params: mergedParams,
          visited,
        });
      }
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
    // One computed per set of params. Building a url reads the route family's
    // signals (see readSignalForUrlBuild) and verifies the candidate against
    // every pattern of the family; a list of a hundred links to one route
    // would do that a hundred times on each of its renders. A computed does it
    // once, again only when a signal it read changes — and a component reading
    // it subscribes to exactly those, which is what reading the signals during
    // render gave it.
    const relativeUrlByParamsKey = new Map();
    route.buildRelativeUrl = (params) => {
      const paramsKey = getParamsCacheKey(params);
      if (paramsKey === null) {
        return routePattern.buildMostPreciseUrl(params);
      }
      let relativeUrlComputed = relativeUrlByParamsKey.get(paramsKey);
      if (!relativeUrlComputed) {
        if (relativeUrlByParamsKey.size >= PARAMS_CACHE_MAX) {
          relativeUrlByParamsKey.clear();
        }
        relativeUrlComputed = computed(() =>
          routePattern.buildMostPreciseUrl(params),
        );
        relativeUrlByParamsKey.set(paramsKey, relativeUrlComputed);
      }
      return relativeUrlComputed.value;
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
    route.redirectTo = (
      params,
      { callReason, history = "replace", debounceUrl, isSignalChange } = {},
    ) => {
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
        replace: history !== "push",
        debounce: debounceUrl,
        callReason,
        fromSignal: isSignalChange,
      });
    };
    route.replaceParams = (
      newParams,
      { callReason, isSignalChange, history = "replace", debounceUrl } = {},
    ) => {
      const matching = route.matchingSignal.peek();
      if (!matching) {
        console.warn(
          `Cannot replace params on route ${route} because it is not matching the current URL.`,
        );
        return null;
      }

      const mostSpecificRoute = findMostSpecificMatchingRoute(route, routeSet);
      const isMostSpecificRoute = mostSpecificRoute === route;

      if (DEBUG) {
        console.debug(
          `[${route}] Most specific route selected: ${mostSpecificRoute}`,
        );
        console.debug(
          `[${route}] Building URL with params:`,
          newParams,
          `on route ${mostSpecificRoute}`,
        );
      }

      // If we found a more specific route, delegate to it; otherwise handle it ourselves.
      // A signal change reaches this only when the more specific route does not
      // carry the param (see writeValueInUrl): left to it, the change would be dropped.
      if (!isMostSpecificRoute) {
        if (DEBUG) {
          console.debug(
            `${route} delegating redirect to more specific route ${mostSpecificRoute}`,
          );
        }
        return mostSpecificRoute.redirectTo(newParams, {
          callReason: `replaceParams delegation from ${route} to ${mostSpecificRoute} (original reason: ${callReason})`,
          history,
          debounceUrl,
          isSignalChange,
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
        replace: history !== "push",
        debounce: debounceUrl,
        callReason,
        fromSignal: isSignalChange,
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
    route.paramsSignal = answerAsIf(
      computed(() => {
        const rawParams = route.rawParamsSignal.value;
        const resolvedParams = routePattern.resolveParams(rawParams);
        return resolvedParams;
      }),
    );

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
  registerSetup(({ routeSet }) => {
    const cleanupSet = new Set();
    // important: read connections at setup time so it includes query connections
    // inherited from ancestor patterns
    const { connections } = routePattern;
    // Whether the url write about to be made carries this state's value too.
    // The address is built from every state of the route, so a state written
    // in the same batch as the one writing goes out with it, whichever of
    // their effects runs first — and the one running second finds the address
    // already saying its value, with nothing left to write.
    const carriesState = (connection, rawParams) => {
      const value = connection.signal.peek();
      const urlParamValue = rawParams[connection.paramName];
      if (urlParamValue === undefined) {
        return !connection.isDefaultValue(value);
      }
      if (connection.isDefaultValue(value)) {
        return true;
      }
      return !compareTwoJsValues(value, urlParamValue);
    };
    for (const connection of connections) {
      const { signal: paramSignal, debug, paramName } = connection;
      // What the navigation is worth in the history: what each write it
      // carries asks — what its state declares, or what the write said instead
      // (see stateSignal's `history` and its `set`) — and one asking a push
      // makes it one: a replace beside it (a page put back to 1 when a tab
      // changes) is part of the same move, and must not cancel the entry the
      // move asked for. Read at the moment of the navigation and never before.
      const historyOfWrite = () => {
        let history = paramSignal.options.takeHistoryOfWrite();
        const rawParams = route.rawParamsSignal.peek();
        for (const otherConnection of connections) {
          const otherOptions = otherConnection.signal.options;
          if (
            otherConnection.signal === paramSignal ||
            !otherOptions?.takeHistoryOfWrite ||
            otherOptions.isWrittenByAddress() ||
            !carriesState(otherConnection, rawParams)
          ) {
            continue;
          }
          if (otherOptions.takeHistoryOfWrite() === "push") {
            history = "push";
          }
        }
        return history;
      };
      // Milliseconds the browser's address waits for this state to settle
      // (see stateSignal's `debounceUrl`); 0 writes at once. A plain signal says nothing.
      const debounceUrl = paramSignal.options?.debounceUrl || 0;
      if (debug) {
        console.debug(
          `[route] connecting url param "${paramName}" to signal`,
          paramSignal,
        );
      }
      const writeValueInUrl = (value) => {
        // What the address wrote, it says already. A value it could not hold
        // as written (autoFix) is put back by the pass that wrote it
        // (repairedParamsByRoute). What anything writes in reaction to it —
        // an effect resetting a page when a filter changes — is a write of its
        // own, and goes on.
        if (paramSignal.options.isWrittenByAddress()) {
          return;
        }
        const rawParams = route.rawParamsSignal.peek();
        const urlParamValue = rawParams[paramName];
        const matching = route.matchingSignal.peek();

        if (!matching) {
          // Route not matching, no URL sync needed
          return;
        }
        // A param declared on an ancestor is carried by every route below it,
        // each with its own connection: all of them hear the write, the most
        // specific one makes it. The others step aside before the history is
        // read — a stateSignalGroup's push goes to the first write reading it.
        const mostSpecificRoute = findMostSpecificMatchingRoute(
          route,
          routeSet,
        );
        if (mostSpecificRoute !== route) {
          const { pathConnectionMap, queryConnectionMap } =
            getRoutePrivateProperties(mostSpecificRoute).routePattern;
          if (
            pathConnectionMap.has(paramName) ||
            queryConnectionMap.has(paramName)
          ) {
            return;
          }
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
              history: historyOfWrite(),
              debounceUrl,
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
              history: historyOfWrite(),
              debounceUrl,
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
            history: historyOfWrite(),
            debounceUrl,
          },
        );
      };
      const cleanupSignalUrlEffect = effect(() => {
        const value = paramSignal.value;
        // Only the param signal re-runs this effect. Writing the url reads
        // more (the route's other params, to build it): subscribed to those,
        // the write is made again whenever one of them changes — a second
        // entry when the write pushes.
        untracked(() => writeValueInUrl(value));
      });
      cleanupSet.add(cleanupSignalUrlEffect);
      // A state kept per owner starts again when the owner changes, as at
      // creation: the address has the last word, as the routing pass gives it
      // (see sync_routes_with_url). Null when the address leaves it to storage.
      const { addressReaderSet } = connection;
      if (addressReaderSet) {
        const readAddress = () => {
          if (!route.matchingSignal.peek()) {
            return null;
          }
          const urlParamValue = route.rawParamsSignal.peek()[paramName];
          if (urlParamValue !== undefined) {
            return { value: urlParamValue };
          }
          if (
            connection.paramType === "query" &&
            connection.history !== "push"
          ) {
            return null;
          }
          return { value: connection.getDefaultValue() };
        };
        addressReaderSet.add(readAddress);
        cleanupSet.add(() => {
          addressReaderSet.delete(readAddress);
        });
      }
    }
    return () => {
      for (const cleanup of cleanupSet) {
        cleanup();
      }
    };
  });

  return route;
};

let redirectingRouteSet = null;
let droppingRouteSet = null;
/**
 * Where does this url really lead?
 *
 * Asked at the door of every navigation, before the url is written anywhere —
 * an address that only sends elsewhere must not become a page, an entry in the
 * history, or a route anything can see matching. Answered from the url, plus
 * what the target's own url carries: its non-weak states, as a link to it
 * would.
 *
 * The chain is followed here rather than by letting each redirection navigate
 * in turn, so one navigation happens and the addresses in between leave no
 * trace at all.
 *
 * @param {string} url
 * @returns {string|null} The url to go to instead, or null.
 */
export const resolveRouteRedirection = (url) => {
  if (
    !redirectingRouteSet ||
    (redirectingRouteSet.size === 0 && droppingRouteSet.size === 0)
  ) {
    return null;
  }
  let urlToResolve = url;
  let redirectionUrl = null;
  const urlChain = [url];
  while (true) {
    // A redirection first: the address it lands on may carry a param its own
    // route drops, and the next turn removes it there.
    const nextUrl =
      resolveRedirectionOnce(urlToResolve) ||
      dropSearchParamsOnce(urlToResolve);
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
// The query is edited as written (see amendSearch).
const dropSearchParamsOnce = (url) => {
  const urlObject = new URL(url);
  if (!urlObject.search) {
    return null;
  }
  for (const route of droppingRouteSet) {
    const { routePattern, dropSearchParams } = getRoutePrivateProperties(route);
    // exact, for the same reason as a redirection: the addresses below a
    // trailing slash belong to the routes declared for them
    if (!routePattern.applyOn(url, { exact: true })) {
      continue;
    }
    const searchKept = amendSearch(urlObject.search, (name) =>
      dropSearchParams.includes(name),
    );
    if (searchKept === urlObject.search) {
      continue;
    }
    urlObject.search = searchKept;
    return urlObject.href;
  }
  return null;
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
let activeRouteSet = null;
// True once the routes have been matched against an address. Before that, no
// route matching says nothing about the page: nothing has been asked yet.
export const routedSignal = signal(false);

const routePreloadMap = new WeakMap();
export const registerRoutePreload = (route, preload) => {
  let preloadSet = routePreloadMap.get(route);
  if (!preloadSet) {
    preloadSet = new Set();
    routePreloadMap.set(route, preloadSet);
  }
  preloadSet.add(preload);
};
/**
 * Preloads every route the url leads to, a section and the page inside it
 * alike. What a link does when the pointer or the focus reaches it (see
 * use_preload_on_intent.js), available to anything else that knows where it
 * is about to go.
 *
 * Read as a link reads it: relative to the document, and only on this
 * origin — another site sharing a path has none of these routes. A route
 * redirecting elsewhere preloads where the navigation would land.
 */
export const preloadUrl = (url) => {
  if (!activeRouteSet) {
    return;
  }
  const urlObject = new URL(url, document.baseURI);
  if (urlObject.origin !== window.location.origin) {
    return;
  }
  let destinationUrl = urlObject.href;
  try {
    destinationUrl = resolveRouteRedirection(destinationUrl) || destinationUrl;
  } catch {
    // A redirection cycle: the navigation will say it, nothing to preload.
    return;
  }
  for (const route of activeRouteSet) {
    const { routePattern } = getRoutePrivateProperties(route);
    if (routePattern.applyOn(destinationUrl)) {
      route.preload();
    }
  }
};

// What a reload asks of each action bound to a route (see routeAction): the
// action to run again, or nothing when its params ask nothing.
const routeReloadMap = new WeakMap();
export const registerRouteReload = (route, reload) => {
  let reloadSet = routeReloadMap.get(route);
  if (!reloadSet) {
    reloadSet = new Set();
    routeReloadMap.set(route, reloadSet);
  }
  reloadSet.add(reload);
};

const routeStatePreloadMap = new WeakMap();
export const registerRouteStatePreload = (route, preload) => {
  let preloadSet = routeStatePreloadMap.get(route);
  if (!preloadSet) {
    preloadSet = new Set();
    routeStatePreloadMap.set(route, preloadSet);
  }
  preloadSet.add(preload);
};
/**
 * Preloads what the routes one is on will ask for once `signal` holds
 * `value`: the address a popup's opening is about to write (see
 * open_controller.js), known at the press that opens it. Only the routes
 * matching now are asked — writing a state keeps one on the same page.
 */
export const preloadState = (signal, value) => {
  if (!activeRouteSet) {
    return;
  }
  const values = new Map([[signal, value]]);
  for (const route of activeRouteSet) {
    if (!route.matchingSignal.peek()) {
      continue;
    }
    const preloadSet = routeStatePreloadMap.get(route);
    if (!preloadSet) {
      continue;
    }
    for (const preload of preloadSet) {
      preload(values);
    }
  }
};
// What the states of a route will hold once the address is `route.buildUrl(params)`,
// as the routing pass will write them (see sync_routes_with_url): a param given is
// what its state holds there; a weak one not given is back to its default, a url
// built for another visit never carries it (readSignalForUrlBuild); any other one
// is carried over by that url and keeps what it holds, so it is left out.
// And what the route says about itself there: that it matches, and the params
// that address gives it — a route action's params read the route's own params
// (paramsSignal) as often as its states, a path param bound to no state too.
const statesAt = (route, params) => {
  const values = new Map();
  const { routePattern } = getRoutePrivateProperties(route);
  const rawParamsThere = untracked(() =>
    routePattern.applyOn(route.buildUrl(params)),
  );
  if (rawParamsThere) {
    values.set(route.matchingSignal, true);
    values.set(route.rawParamsSignal, rawParamsThere);
    values.set(route.paramsSignal, routePattern.resolveParams(rawParamsThere));
  }
  for (const connection of routePattern.connections) {
    const { paramName, signal } = connection;
    if (!signal) {
      continue;
    }
    if (!(paramName in params)) {
      if (connection.weak) {
        values.set(signal, connection.getDefaultValue());
      }
      continue;
    }
    const value = params[paramName];
    if (value !== undefined) {
      values.set(signal, value);
      continue;
    }
    // An address silent about a persisted search param leaves it alone.
    if (
      connection.persists &&
      connection.paramType === "query" &&
      connection.history !== "push"
    ) {
      continue;
    }
    values.set(signal, connection.getDefaultValue());
  }
  return values;
};
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
  activeRouteSet = routeSet;
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
  droppingRouteSet = new Set();
  for (const route of routeSet) {
    const { redirectRoute, dropSearchParams } =
      getRoutePrivateProperties(route);
    if (dropSearchParams && dropSearchParams.length) {
      droppingRouteSet.add(route);
    }
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
  let previousPath = null;
  const updateRoutes = (
    url,
    {
      navigationType,
      isVisited = () => false,
      // state
    } = {},
  ) => {
    // Whether a route matches is decided by the path alone: the search string
    // only fills the params (see matchUrl). An address that keeps its path — a
    // search param written, at every notch of a wheel bound to it — cannot make
    // a route start or stop matching, so only the routes already matching are
    // read again.
    const path = urlWithoutSearchAndHash(url);
    const pathKept = path === previousPath;
    // A new path is a new page: what the integration tells whatever reacts to
    // this change in the render it causes (see page_change.js). Not the first
    // one — there was no page before it, and what it mounts mounts as it is.
    const pageChanged = previousPath !== null && !pathKept;
    const returnValue = { pageChanged };
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

      let extractedParams =
        pathKept && !oldMatching ? null : routePattern.applyOn(url);
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
    }
    // Recorded once every route has been read: a route that throws on the
    // way (a param constraint) leaves the previous address as the one the
    // routes were read on, rather than this path with routes never read on it
    // — which the next pass on the same path would skip (pathKept).
    currentUrl = url;
    previousPath = path;
    for (const {
      route,
      newMatching,
      newParams,
      oldActionParams,
    } of routeMatchInfoSet) {
      routePreviousStateMap.set(route, {
        matching: newMatching,
        params: newParams,
        actionParams: oldActionParams, // updated to newActionParams in update_route_actions
      });
    }

    sync_routes_with_url: {
      // URL -> Signal synchronization (moved from individual route effects to eliminate circular dependency)
      // Every state is written as the address's own (writeStateFromAddress):
      // its url write then stays silent, whenever its effects run.
      const matchingRouteSet = new Set();
      // Params the address gave and the state could not hold as written
      // (autoFix): the address is rewritten with what the state holds, once
      // the sync is over, so the repaired value is not left in the url to be
      // replayed by a reload or a copied link.
      const repairedParamsByRoute = new Map();
      // A query connection is inherited by the child routes of the one
      // declaring it: the first route to record a param answers for all.
      const repairedParamNameSet = new Set();
      // An effect reacting to these writes that throws is its own failure,
      // not the routing's: the routes have changed, and the pass goes on to
      // the end (publishing, repairs, the rest of the navigation).
      batchWithEffectErrorsApart(() => {
        for (const {
          route,
          routePrivateProperties,
          newMatching,
          newParams,
        } of routeMatchInfoSet) {
          const { updateStatus } = routePrivateProperties;
          const visited = isVisited(route.url);
          updateStatus({
            matching: newMatching,
            params: newParams,
            visited,
          });
          if (newMatching) {
            matchingRouteSet.add(route);
          }
        }

        // What the matching routes say, read once for every connection of every
        // route that does not match (below), rather than by walking all the
        // routes again for each of those connections.
        const matchingRawParamsArray = [];
        const paramNameDeclaredByMatchingRouteSet = new Set();
        const matchingFamilyRootSet = new Set();
        // One state, one reading per pass: among the matching routes declaring
        // it, the most specific (deepest) one reads it from the address — the
        // route a write of it lands on (see writeValueInUrl). Its default is
        // the one an address silent about it opens on, whatever the order the
        // routes were given to setupRoutes in.
        const readingBySignal = new Map();
        for (const matchingRoute of matchingRouteSet) {
          matchingRawParamsArray.push(matchingRoute.rawParamsSignal.value);
          const matchingPattern =
            getRoutePrivateProperties(matchingRoute).routePattern;
          for (const paramName of matchingPattern.queryConnectionMap.keys()) {
            paramNameDeclaredByMatchingRouteSet.add(paramName);
          }
          for (const paramName of matchingPattern.pathConnectionMap.keys()) {
            paramNameDeclaredByMatchingRouteSet.add(paramName);
          }
          matchingFamilyRootSet.add(matchingPattern.familyRoot);
          for (const connection of matchingPattern.connections) {
            const reading = readingBySignal.get(connection.signal);
            if (reading && reading.depth >= matchingPattern.depth) {
              continue;
            }
            readingBySignal.set(connection.signal, {
              connection,
              depth: matchingPattern.depth,
            });
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
              // Whether a matching route extracts this parameter from the url
              const parameterExtractedByMatchingRoute =
                matchingRawParamsArray.some(
                  (matchingRawParams) => paramName in matchingRawParams,
                );
              // Same param, on the page one is arriving at: what it is worth
              // there is that page's business, url or no url — it may open on
              // a default of its own (see searchParams' `{ signal, default }`).
              const parameterDeclaredByMatchingRoute =
                paramNameDeclaredByMatchingRouteSet.has(paramName);
              // Same family = same topmost ancestor
              // (familyRoot, computed in setupRoutePatterns)
              const matchingRouteInSameFamily = matchingFamilyRootSet.has(
                routePattern.familyRoot,
              );

              // A weak param qualifies one visit: leaving the route ends it,
              // whatever the family and whatever the default. Coming back by a
              // url that does not carry the param comes back to a blank screen.
              if (connection.weak) {
                if (
                  !parameterExtractedByMatchingRoute &&
                  !parameterDeclaredByMatchingRoute
                ) {
                  const defaultValue = connection.getDefaultValue();
                  if (debug) {
                    console.debug(
                      `[route] weak param ${paramName}: route no longer matching, back to ${defaultValue}`,
                    );
                  }
                  writeStateFromAddress(paramSignal, defaultValue);
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
                  writeStateFromAddress(paramSignal, undefined);
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

            if (readingBySignal.get(paramSignal).connection !== connection) {
              continue;
            }
            // URL -> Signal sync: When route matches, ensure signal matches URL state
            // URL is the source of truth for explicit parameters
            const value = paramSignal.peek();
            if (urlParamValue === undefined) {
              // An address silent about a persisted search param leaves it
              // alone: the state already holds what is stored (it starts from
              // storage and every write goes back to it), and a reset here
              // would empty the storage as well. Reading the storage back is
              // not an option either: the write that removes the param from
              // the address is the one emptying its storage, and this sync can
              // run before that removal has happened.
              // A path segment or a pushed param names a place, and an address
              // without it is the place without it: those follow the address.
              if (
                connection.persists &&
                connection.paramType === "query" &&
                connection.history !== "push"
              ) {
                continue;
              }
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
              writeStateFromAddress(paramSignal, defaultValue);
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
            writeStateFromAddress(paramSignal, urlParamValue);
            if (
              paramSignal.validity?.autoFixed &&
              !repairedParamNameSet.has(paramName)
            ) {
              repairedParamNameSet.add(paramName);
              const repairedValue = paramSignal.peek();
              if (debug) {
                console.debug(
                  `[route] URL->Signal: ${paramName}=${urlParamValue} repaired to ${repairedValue}, the url will be rewritten`,
                );
              }
              let repairedParams = repairedParamsByRoute.get(route);
              if (!repairedParams) {
                repairedParams = {};
                repairedParamsByRoute.set(route, repairedParams);
              }
              // A default is not written in an address (see the signal -> url sync)
              repairedParams[paramName] = connection.isDefaultValue(
                repairedValue,
              )
                ? undefined
                : repairedValue;
            }
            continue;
          }
        }
      });
      routedSignal.value = true;
      Object.assign(returnValue, { matchingRouteSet });
      for (const [route, repairedParams] of repairedParamsByRoute) {
        route.replaceParams(repairedParams, {
          callReason: `url params repaired on ${route}: ${Object.keys(repairedParams).join(", ")}`,
          history: "replace",
        });
      }
    }

    // A route's actions run again when their params change (see routeAction),
    // and a reload changes none: it asks again for the page one is on. So the
    // actions of every matching route are handed back, to be rerun — except
    // those whose params ask nothing.
    if (navigationType === "reload") {
      const reloadSet = new Set();
      for (const route of returnValue.matchingRouteSet) {
        const routeReloadSet = routeReloadMap.get(route);
        if (!routeReloadSet) {
          continue;
        }
        for (const reload of routeReloadSet) {
          const actionToRerun = reload();
          if (actionToRerun) {
            reloadSet.add(actionToRerun);
          }
        }
      }
      returnValue.reloadSet = reloadSet;
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
    droppingRouteSet = null;
    setupRoutesCalled = false;
    activeRouteSet = null;
    activeCleanup = null;
    routedSignal.value = false;
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
      "The route prop must be a route object created with route()",
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

// Params are cached by content, and only params whose content a string can
// stand for: anything else (an object, a function) builds without the cache.
// A key set to undefined is content too — it says "without this one", which
// a params object not naming it does not say (see buildIntendedState).
const PARAMS_CACHE_MAX = 1000;
export const getParamsCacheKey = (params) => {
  if (params === undefined || params === null) {
    return "";
  }
  if (typeof params !== "object") {
    return null;
  }
  const keys = Object.keys(params).sort();
  let key = "";
  for (const name of keys) {
    const value = params[name];
    const type = typeof value;
    if (
      value !== null &&
      value !== undefined &&
      type !== "string" &&
      type !== "number" &&
      type !== "boolean"
    ) {
      return null;
    }
    // JSON for the value: a string holding a line break cannot pass for two
    // entries.
    key += `${name}=${type}:${JSON.stringify(value)}\n`;
  }
  return key;
};

const urlWithoutSearchAndHash = (url) => {
  const urlObject = new URL(url);
  return `${urlObject.origin}${urlObject.pathname}`;
};

// Deeper is more specific: among the routes matching the address, the one a
// params write lands on.
const findMostSpecificMatchingRoute = (route, routeSet) => {
  let mostSpecificRoute = route;
  let maxDepth = getRoutePrivateProperties(route).routePattern.depth;
  for (const routeCandidate of routeSet) {
    if (routeCandidate === route) {
      continue;
    }
    if (!routeCandidate.matching) {
      continue;
    }
    const depth = getRoutePrivateProperties(routeCandidate).routePattern.depth;
    if (depth > maxDepth) {
      maxDepth = depth;
      mostSpecificRoute = routeCandidate;
    }
  }
  return mostSpecificRoute;
};
