/**
 *
 * . Refactor les actions pour qu'elles utilisent use. Ce qui va ouvrir la voie pour
 * Suspense et ErrorBoundary sur tous les composants utilisant des actions
 *
 * . Tester le code splitting avec .lazy + import dynamique
 * pour les elements des routes
 *
 * 3. Ajouter la possibilite d'avoir des
 *  sur les routes
 * Tester juste les data pour commencer
 * On aura ptet besoin d'un useRouteData au lieu de passer par un element qui est une fonction
 * pour que react ne re-render pas tout
 *
 * 4. Utiliser use() pour compar Suspense et ErrorBoundary lorsque route action se produit.
 *
 *
 */

import { signal } from "@preact/signals";
import { createContext } from "preact";
import { useContext, useLayoutEffect, useReducer, useRef } from "preact/hooks";

import { ActionRenderer } from "../action/action_renderer.jsx";
import { useUITransitionContentId } from "../ui_transition/ui_transition.jsx";
import { useRouteStatus } from "./route.js";

const DEBUG = true;
const debug = (...args) => {
  if (!DEBUG) {
    return;
  }
  console.debug(...args);
};

// <Route> splits first on children presence, then on route/fallback:
// RouteLeaf (no children):
//   - route only: renders when URL matches
//   - fallback only: renders when no sibling route is active
//   - route + fallback: renders when URL matches AND no sibling route is active
// RouteWithChildren (has children):
//   - route only: renders when URL matches, provides context for nested routes
//   - neither: container — manages child matching, optionally wraps in a layout element
export const Route = (props) => {
  if (props.children) {
    return <RouteWithChildren {...props} />;
  }
  return <RouteLeaf {...props} />;
};

// RouteWithChildren: has JSX children — dispatches based on route/fallback props.
const RouteWithChildren = (props) => {
  if (props.route) {
    return <RouteWithChildrenAndRoute {...props} />;
  }
  return <RouteAsContainer {...props} />;
};
// ProbingContext: true during the first render cycle where children run their
// route checks and update the parent's matchingSiblingsCount, but return null.
// The parent re-renders once the signal changes and switches probing to false.
// This ensures the layout element is never put in the DOM before we know
// whether any child route actually matches.
const ProbingContext = createContext(false);
const MatchingChildrenContext = createContext(null);
const useMatchingChildren = () => {
  const ref = useRef();
  const matchingChildrenFromRef = ref.current;
  if (matchingChildrenFromRef) {
    return matchingChildrenFromRef;
  }
  const matchingChildren = createMatchingChildren();
  ref.current = matchingChildren;
  return matchingChildren;
};
let matchingChildrenIdCounter = 0;
const createMatchingChildren = () => {
  const trackerId = matchingChildrenIdCounter++;
  // routeCount: incremented by RouteLeaf/RouteWithChildren/RouteAsContainer only.
  // Used by FallbackOnly/RouteWithFallback to decide whether to activate.
  let routeCount = 0;
  const hasActiveRouteSignal = signal(false);
  // totalCount: routeCount + fallback activations.
  // Used by RouteAsContainer to decide its own visibility / whether to show its element.
  let totalCount = 0;
  const hasActiveChildSignal = signal(false);
  let probing = true;

  return {
    trackerId,
    endProbe: () => {
      debug(
        `[tracker ${trackerId}] endProbe, routeCount=${routeCount}, totalCount=${totalCount}`,
      );
      probing = false;
      hasActiveRouteSignal.value = routeCount > 0;
      hasActiveChildSignal.value = totalCount > 0;
    },
    // For FallbackOnly/RouteWithFallback: "did any sibling RouteLeaf/RouteWithChildren match?"
    useHasActiveRoute: () => hasActiveRouteSignal.value,
    // For RouteAsContainer: "is any child active (route or fallback)?"
    useHasActiveChild: () => hasActiveChildSignal.value,
    getCount: () => totalCount,
    reportRouteMatch: () => {
      routeCount++;
      totalCount++;
      debug(
        `[tracker ${trackerId}] reportRouteMatch, routeCount=${routeCount}, totalCount=${totalCount}`,
      );
      if (!probing) {
        if (routeCount === 1) hasActiveRouteSignal.value = true;
        if (totalCount === 1) hasActiveChildSignal.value = true;
      }
    },
    reportRouteUnmatch: () => {
      routeCount--;
      totalCount--;
      debug(
        `[tracker ${trackerId}] reportRouteUnmatch, routeCount=${routeCount}, totalCount=${totalCount}`,
      );
      if (!probing) {
        if (routeCount === 0) hasActiveRouteSignal.value = false;
        if (totalCount === 0) hasActiveChildSignal.value = false;
      }
    },
    reportFallbackActive: () => {
      totalCount++;
      debug(
        `[tracker ${trackerId}] reportFallbackActive, totalCount=${totalCount}`,
      );
      if (!probing && totalCount === 1) hasActiveChildSignal.value = true;
    },
    reportFallbackInactive: () => {
      totalCount--;
      debug(
        `[tracker ${trackerId}] reportFallbackInactive, totalCount=${totalCount}`,
      );
      if (!probing && totalCount === 0) hasActiveChildSignal.value = false;
    },
  };
};
const useMatchingSiblingsContext = import.meta.dev
  ? () => {
      const matchingSiblings = useContext(MatchingChildrenContext);
      if (!matchingSiblings) {
        throw new Error(
          "<Route> with route or fallback prop must be a child of a <Route> without route prop",
        );
      }
      return matchingSiblings;
    }
  : () => useContext(MatchingChildrenContext);
// ChildrenRoute: route with JSX children (nested routes).
// Provides MatchingChildrenContext so nested routes can report to this route's tracker.
const RouteWithChildrenAndRoute = (props) => {
  const isProbing = useContext(ProbingContext);
  const matchingSiblings = useMatchingSiblingsContext();
  const { route, routeParams } = props;
  const { matching } = useRouteStatus(route);
  const isMatching =
    matching && (!routeParams || route.matchesParams(routeParams));
  const matchingChildren = useMatchingChildren();

  debug(
    `[route "${route.urlPattern}"] RENDER (with-children), isMatching=${isMatching}, isProbing=${isProbing}`,
  );

  useUITransitionContentId(route.urlPattern);
  useLayoutEffect(() => {
    if (!isMatching) {
      return undefined;
    }
    debug(`[route "${route.urlPattern}"] reporting route match`);
    matchingSiblings.reportRouteMatch();
    return () => {
      debug(`[route "${route.urlPattern}"] reporting route unmatch`);
      matchingSiblings.reportRouteUnmatch();
    };
  }, [isMatching]);

  if (!isMatching || isProbing) {
    return null;
  }
  debug(`[route "${route.urlPattern}"] rendering content with children`);
  return (
    <MatchingChildrenContext.Provider value={matchingChildren}>
      <RouteActive {...props} />
    </MatchingChildrenContext.Provider>
  );
};
const RouteAsContainer = ({ id, element, elementProps, children }) => {
  const matchingSiblings = useContext(MatchingChildrenContext); // null if no ancestor Route
  const matchingChildren = useMatchingChildren();
  const hasActiveChild = matchingChildren.useHasActiveChild(); // reactive, re-renders only when boolean flips
  const hasProbedRef = useRef(false);
  const isProbing = !hasProbedRef.current;
  const prevReportedRef = useRef(false);
  const [renderCount, forceRender] = useReducer((n) => n + 1, 0);

  debug(
    `[container "${id}"] RENDER #${renderCount}, isProbing=${isProbing}, hasActiveChild=${hasActiveChild}, ` +
      `ownTracker=${matchingChildren.trackerId}, parentTracker=${matchingSiblings ? matchingSiblings.trackerId : "none"}, ` +
      `childCount=${matchingChildren.getCount()}`,
  );

  // Probe effect: fires once on mount, bottom-up after children have reported.
  // endProbe() finalizes the signals and enables reactive updates for dynamic changes.
  useLayoutEffect(() => {
    hasProbedRef.current = true;
    const childCount = matchingChildren.getCount();
    debug(
      `[container "${id}"] PROBE EFFECT, childCount=${childCount}, parentTracker=${matchingSiblings ? matchingSiblings.trackerId : "none"}`,
    );
    if (matchingSiblings && childCount > 0) {
      debug(
        `[container "${id}"] reporting route match to parent tracker ${matchingSiblings.trackerId}`,
      );
      prevReportedRef.current = true;
      matchingSiblings.reportRouteMatch();
    }
    matchingChildren.endProbe();
    debug(`[container "${id}"] calling forceRender`);
    forceRender();
    return () => {
      debug(`[container "${id}"] PROBE CLEANUP`);
      if (prevReportedRef.current) {
        prevReportedRef.current = false;
        matchingSiblings.reportRouteUnmatch();
      }
    };
  }, []);

  // Post-probe: sync report to parent when hasActiveChild changes.
  // Skip the first run — the probe effect above already handled the initial report.
  const didMountRef = useRef(false);
  useLayoutEffect(() => {
    if (!didMountRef.current) {
      debug(
        `[container "${id}"] HASACTIVECHILD EFFECT (mount), skipping — probe handled it`,
      );
      didMountRef.current = true;
      return;
    }
    debug(
      `[container "${id}"] HASACTIVECHILD EFFECT, hasActiveChild=${hasActiveChild}, prevReported=${prevReportedRef.current}, ` +
        `parentTracker=${matchingSiblings ? matchingSiblings.trackerId : "none"}`,
    );
    if (!matchingSiblings) {
      debug(`[container "${id}"] no parent, skipping report`);
      return;
    }
    if (hasActiveChild === prevReportedRef.current) {
      return;
    }
    if (hasActiveChild) {
      debug(`[container "${id}"] post-probe reporting route match to parent`);
      prevReportedRef.current = true;
      matchingSiblings.reportRouteMatch();
    } else {
      debug(`[container "${id}"] post-probe reporting route unmatch to parent`);
      prevReportedRef.current = false;
      matchingSiblings.reportRouteUnmatch();
    }
  }, [hasActiveChild]);

  // During probe: render children with ProbingContext=true (routes return null, report via effects).
  // After probe: always render children to keep routes mounted for reactive reporting.
  if (isProbing) {
    debug(`[container "${id}"] rendering children, isProbing=true`);
    return (
      <MatchingChildrenContext.Provider value={matchingChildren}>
        <ProbingContext.Provider value={true}>
          {children}
        </ProbingContext.Provider>
      </MatchingChildrenContext.Provider>
    );
  }
  if (hasActiveChild) {
    debug(`[container "${id}"] rendering children, hasActiveChild=true`);
    const inner = (
      <MatchingChildrenContext.Provider value={matchingChildren}>
        <ProbingContext.Provider value={false}>
          {children}
        </ProbingContext.Provider>
      </MatchingChildrenContext.Provider>
    );
    if (element) {
      const Element = element;
      return <Element {...elementProps}>{inner}</Element>;
    }
    return inner;
  }
  debug(`[container "${id}"] rendering children bare (no active child)`);
  return (
    <MatchingChildrenContext.Provider value={matchingChildren}>
      <ProbingContext.Provider value={false}>
        {children}
      </ProbingContext.Provider>
    </MatchingChildrenContext.Provider>
  );
};

// RouteLeaf: no JSX children — dispatches based on route/fallback props.
const RouteLeaf = (props) => {
  if (props.route && props.fallback) {
    return <RouteLeafWithFallbackAndRoute {...props} />;
  }
  if (props.route) {
    return <RouteLeafRouteOnly {...props} />;
  }
  if (props.fallback) {
    return <RouteLeafFallbackOnly {...props} />;
  }
  return null;
};

const RouteLeafWithFallbackAndRoute = (props) => {
  const isProbing = useContext(ProbingContext);
  const matchingSiblings = useMatchingSiblingsContext();
  const hasActiveSiblingRoute = matchingSiblings.useHasActiveRoute();
  const { route, routeParams } = props;
  const { matching } = useRouteStatus(route);
  const isMatching =
    matching && (!routeParams || route.matchesParams(routeParams));
  const isActive = !isProbing && !hasActiveSiblingRoute && isMatching;

  useUITransitionContentId(route.urlPattern);
  useLayoutEffect(() => {
    if (!isActive) {
      return undefined;
    }
    matchingSiblings.reportFallbackActive();
    return () => matchingSiblings.reportFallbackInactive();
  }, [isActive]);

  if (!isActive) {
    return null;
  }
  return <RouteActive {...props} />;
};
// LeafRoute: route without children — renders when URL matches.
// No matchingChildren tracker needed since there are no nested Route components.
const RouteLeafRouteOnly = (props) => {
  const isProbing = useContext(ProbingContext);
  const matchingSiblings = useMatchingSiblingsContext();
  const { route, routeParams } = props;
  const { matching } = useRouteStatus(route);
  const isMatching =
    matching && (!routeParams || route.matchesParams(routeParams));

  debug(
    `[route "${route.urlPattern}"] RENDER (leaf), isMatching=${isMatching}, isProbing=${isProbing}`,
  );

  useUITransitionContentId(route.urlPattern);
  useLayoutEffect(() => {
    if (!isMatching) {
      return undefined;
    }
    debug(`[route "${route.urlPattern}"] reporting route match`);
    matchingSiblings.reportRouteMatch();
    return () => {
      debug(`[route "${route.urlPattern}"] reporting route unmatch`);
      matchingSiblings.reportRouteUnmatch();
    };
  }, [isMatching]);

  if (!isMatching || isProbing) {
    return null;
  }
  debug(`[route "${route.urlPattern}"] rendering content`);
  return <RouteActive {...props} />;
};
const RouteLeafFallbackOnly = (props) => {
  const isProbing = useContext(ProbingContext);
  const matchingSiblings = useMatchingSiblingsContext();
  const hasActiveSiblingRoute = matchingSiblings.useHasActiveRoute();
  const isActive = !isProbing && !hasActiveSiblingRoute;

  useLayoutEffect(() => {
    if (!isActive) {
      return undefined;
    }
    matchingSiblings.reportFallbackActive();
    return () => matchingSiblings.reportFallbackInactive();
  }, [isActive]);

  if (!isActive) {
    return null;
  }
  return <RouteActive {...props} />;
};

const RouteInfoContext = createContext(null);
const RouteActive = ({
  route,
  element,
  elementProps,
  action,
  meta,
  children,
}) => {
  const Element = element;
  const renderedElement = action ? (
    <ActionRenderer action={action}>{element}</ActionRenderer>
  ) : typeof element === "function" ? (
    <Element {...elementProps} />
  ) : (
    element
  );
  return (
    <RouteInfoContext.Provider value={{ route, meta }}>
      {renderedElement}
      {children}
    </RouteInfoContext.Provider>
  );
};

export const useMatchingRouteInfo = () => {
  const routeInfo = useContext(RouteInfoContext);
  return routeInfo;
};
