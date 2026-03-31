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
import { useContext, useLayoutEffect, useRef } from "preact/hooks";

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
// RouteWithChildren (has children):
//   - route only: renders when URL matches, provides context for nested routes
//   - neither: container — manages child matching, optionally wraps in a layout element
// RouteLeaf (no children):
//   - route only: renders when URL matches
//   - fallback only: renders when no sibling route is active
//   - route + fallback: renders when URL matches AND no sibling route is active
export const Route = (props) => {
  if (props.children) {
    return <RouteWithChildren {...props} />;
  }
  return <RouteLeaf {...props} />;
};

// RouteWithChildren: has JSX children — dispatches based on route/fallback props.
const RouteWithChildren = (props) => {
  if (props.route) {
    return <RouteContainerWithRoute {...props} />;
  }
  return <RouteContainer {...props} />;
};
// Note: no ProbingContext needed. Since useLayoutEffect fires bottom-up,
// children have reported to their parent tracker before the parent's effect runs.
// Signals start as false, so layout elements only appear once a child is active.
// All DOM updates happen before the browser paints (within the useLayoutEffect pass).
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
  // routeCount: only URL-matching routes. Used by fallbacks to decide whether to activate.
  let routeCount = 0;
  const hasActiveRouteSignal = signal(false);
  // totalCount: routes + fallbacks. Used by RouteContainer to decide layout visibility.
  let totalCount = 0;
  const hasActiveChildSignal = signal(false);

  const reportRouteMatch = () => {
    routeCount++;
    totalCount++;
    debug(
      `[tracker ${trackerId}] reportRouteMatch, routeCount=${routeCount}, totalCount=${totalCount}`,
    );
    if (routeCount === 1) {
      hasActiveRouteSignal.value = true;
    }
    if (totalCount === 1) {
      hasActiveChildSignal.value = true;
    }
  };
  const reportRouteUnmatch = () => {
    routeCount--;
    totalCount--;
    debug(
      `[tracker ${trackerId}] reportRouteUnmatch, routeCount=${routeCount}, totalCount=${totalCount}`,
    );
    if (routeCount === 0) {
      hasActiveRouteSignal.value = false;
    }
    if (totalCount === 0) {
      hasActiveChildSignal.value = false;
    }
  };
  const reportFallbackActive = () => {
    totalCount++;
    debug(
      `[tracker ${trackerId}] reportFallbackActive, totalCount=${totalCount}`,
    );
    if (totalCount === 1) {
      hasActiveChildSignal.value = true;
    }
  };
  const reportFallbackInactive = () => {
    totalCount--;
    debug(
      `[tracker ${trackerId}] reportFallbackInactive, totalCount=${totalCount}`,
    );
    if (totalCount === 0) {
      hasActiveChildSignal.value = false;
    }
  };

  return {
    trackerId,
    // For leaf fallbacks: "did any sibling URL-route match?"
    useHasActiveRoute: () => hasActiveRouteSignal.value,
    // For RouteContainer: "is any child active (route or fallback)?"
    useHasActiveChild: () => hasActiveChildSignal.value,
    reportRouteMatch,
    reportRouteUnmatch,
    useReportMatch: (isMatching, route) => {
      useLayoutEffect(() => {
        if (!isMatching) {
          return undefined;
        }
        debug(`[route "${route.urlPattern}"] reporting route match`);
        reportRouteMatch();
        return () => {
          debug(`[route "${route.urlPattern}"] reporting route unmatch`);
          reportRouteUnmatch();
        };
      }, [isMatching]);
    },
    useReportFallbackActive: (isActive) => {
      useLayoutEffect(() => {
        if (!isActive) {
          return undefined;
        }
        reportFallbackActive();
        return () => reportFallbackInactive();
      }, [isActive]);
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
// RouteContainerWithRoute: route with JSX children — renders when URL matches,
// provides MatchingChildrenContext so nested routes can report to this route's tracker.
const RouteContainerWithRoute = (props) => {
  const matchingSiblings = useMatchingSiblingsContext();
  const { route, routeParams } = props;
  const { matching } = useRouteStatus(route);
  const isMatching =
    matching && (!routeParams || route.matchesParams(routeParams));
  const matchingChildren = useMatchingChildren();

  debug(
    `[route "${route.urlPattern}"] RENDER (with-children), isMatching=${isMatching}`,
  );

  useUITransitionContentId(route.urlPattern);
  matchingSiblings.useReportMatch(isMatching, route);

  if (!isMatching) {
    return null;
  }
  debug(`[route "${route.urlPattern}"] rendering content with children`);
  return (
    <MatchingChildrenContext.Provider value={matchingChildren}>
      <RouteActive {...props} />
    </MatchingChildrenContext.Provider>
  );
};
// RouteContainer: manages child route matching, optionally wraps active children in a layout element.
// Children are always rendered (never unmounted) so they can reactively respond to URL changes.
const RouteContainer = ({ id, element, elementProps, children }) => {
  const matchingSiblings = useContext(MatchingChildrenContext); // null if top-level container
  const matchingChildren = useMatchingChildren();
  const hasActiveChild = matchingChildren.useHasActiveChild(); // reactive, re-renders only when boolean flips
  const isMatching = matchingSiblings && hasActiveChild;
  debug(`[container "${id}"] RENDER, hasActiveChild=${hasActiveChild}`);

  // On initial mount hasActiveChild=false (signals start false), so nothing is reported yet.
  // Once a child reports a match the signal flips, we re-render, and this effect fires to report up.
  matchingSiblings.useReportMatch(isMatching);

  const inner = (
    <MatchingChildrenContext.Provider value={matchingChildren}>
      {children}
    </MatchingChildrenContext.Provider>
  );
  if (element && hasActiveChild) {
    debug(`[container "${id}"] rendering children with layout element`);
    const Element = element;
    return <Element {...elementProps}>{inner}</Element>;
  }
  return inner;
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
  const matchingSiblings = useMatchingSiblingsContext();
  const hasActiveSiblingRoute = matchingSiblings.useHasActiveRoute();
  const { route, routeParams } = props;
  const { matching } = useRouteStatus(route);
  const isMatching =
    matching && (!routeParams || route.matchesParams(routeParams));
  const isActive = !hasActiveSiblingRoute && isMatching;

  useUITransitionContentId(route.urlPattern);
  matchingSiblings.useReportFallbackActive(isActive);

  if (!isActive) {
    return null;
  }
  return <RouteActive {...props} />;
};
// RouteLeafRouteOnly: route without children — renders when URL matches.
const RouteLeafRouteOnly = (props) => {
  const matchingSiblings = useMatchingSiblingsContext();
  const { route, routeParams } = props;
  const { matching } = useRouteStatus(route);
  const isMatching =
    matching && (!routeParams || route.matchesParams(routeParams));

  debug(
    `[route "${route.urlPattern}"] RENDER (leaf), isMatching=${isMatching}`,
  );
  useUITransitionContentId(route.urlPattern);
  matchingSiblings.useReportMatch(isMatching, route);

  if (!isMatching) {
    return null;
  }
  debug(`[route "${route.urlPattern}"] rendering content`);
  return <RouteActive {...props} />;
};
const RouteLeafFallbackOnly = (props) => {
  const matchingSiblings = useMatchingSiblingsContext();
  const hasActiveSiblingRoute = matchingSiblings.useHasActiveRoute();
  const isActive = !hasActiveSiblingRoute;

  matchingSiblings.useReportFallbackActive(isActive);

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
