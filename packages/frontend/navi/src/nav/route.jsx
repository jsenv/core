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

// <Route> splits on children presence first:
// - children → RouteContainer (manages child matching, optional layout wrapper)
// - route    → RouteLeafRoute (renders when URL matches)
// - fallback → RouteLeafFallback (renders when no sibling is active)
export const Route = (props) => {
  if (props.children) return <RouteContainer {...props} />;
  if (props.route) return <RouteLeafRoute {...props} />;
  if (props.fallback) return <RouteLeafFallback {...props} />;
  return null;
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
  // Single counter for all active children (routes + fallbacks).
  // Fallback activates only when activeCount === 0.
  let activeCount = 0;
  const hasActiveChildSignal = signal(false);

  const reportMatch = () => {
    activeCount++;
    debug(`[tracker ${trackerId}] reportMatch, activeCount=${activeCount}`);
    if (activeCount === 1) hasActiveChildSignal.value = true;
  };
  const reportUnmatch = () => {
    activeCount--;
    debug(`[tracker ${trackerId}] reportUnmatch, activeCount=${activeCount}`);
    if (activeCount === 0) hasActiveChildSignal.value = false;
  };

  return {
    trackerId,
    // For RouteContainer: is any child active?
    // For RouteLeafFallback: are any siblings active? (same question)
    useHasActiveChild: () => hasActiveChildSignal.value,
    reportMatch,
    reportUnmatch,
    useReportMatch: (isMatching, id) => {
      useLayoutEffect(() => {
        if (!isMatching) return undefined;
        debug(`["${id}"] reporting match`);
        reportMatch();
        return () => {
          debug(`["${id}"] reporting unmatch`);
          reportUnmatch();
        };
      }, [isMatching]);
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
// RouteContainer: manages child route matching, optionally wraps active children in a layout element.
// Children are always rendered (never unmounted) so they can reactively respond to URL changes.
const RouteContainer = ({ id, element, elementProps, children }) => {
  const matchingSiblings = useContext(MatchingChildrenContext); // null if top-level container
  const matchingChildren = useMatchingChildren();
  const hasActiveChild = matchingChildren.useHasActiveChild(); // reactive, re-renders only when boolean flips
  const isMatching = matchingSiblings && hasActiveChild;
  debug(`[container "${id}"] RENDER, hasActiveChild=${hasActiveChild}`);

  if (matchingSiblings) {
    matchingSiblings.useReportMatch(isMatching, id);
  }

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

// RouteLeafRoute: route without children — renders when URL matches.
const RouteLeafRoute = (props) => {
  const matchingSiblings = useMatchingSiblingsContext();
  const { route, routeParams } = props;
  const { matching } = useRouteStatus(route);
  const isMatching =
    matching && (!routeParams || route.matchesParams(routeParams));

  debug(
    `[route "${route.urlPattern}"] RENDER (leaf), isMatching=${isMatching}`,
  );
  useUITransitionContentId(route.urlPattern);
  matchingSiblings.useReportMatch(isMatching, route.urlPattern);

  if (!isMatching) return null;
  debug(`[route "${route.urlPattern}"] rendering content`);
  return <RouteActive {...props} />;
};

// RouteLeafFallback: renders when no sibling route is active.
// On first render activeCount may still be 0 even if a route will match —
// the sibling route's useLayoutEffect fires first (tree order), flips the signal,
// and this component re-renders to null before the browser paints.
const RouteLeafFallback = (props) => {
  const matchingSiblings = useMatchingSiblingsContext();
  const hasActiveSibling = matchingSiblings.useHasActiveChild();
  const isActive = !hasActiveSibling;

  matchingSiblings.useReportMatch(isActive, "fallback");

  if (!isActive) return null;
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
