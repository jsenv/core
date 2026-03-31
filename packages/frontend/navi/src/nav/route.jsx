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

// <Route> has 4 modes based on props:
// 1. route (no fallback): renders when route matches, reports to parent
// 2. route + fallback: renders when route matches AND no sibling matched
// 3. fallback (no route): renders when no sibling matched
// 4. neither: container that manages child matching
export const Route = (props) => {
  if (props.route) {
    if (props.fallback) {
      return <RouteWithFallback {...props} />;
    }
    return <RouteOnly {...props} />;
  }
  if (props.fallback) {
    return <FallbackOnly {...props} />;
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
const createMatchingChildren = () => {
  let count = 0;
  const isMatchingSignal = signal(false);

  return {
    useIsMatching: () => isMatchingSignal.value,
    getCount: () => count,
    reportMatch: () => {
      count++;
      if (count === 1) isMatchingSignal.value = true;
    },
    reportUnmatch: () => {
      count--;
      if (count === 0) isMatchingSignal.value = false;
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

const RouteAsContainer = ({ id, children }) => {
  const matchingSiblings = useContext(MatchingChildrenContext); // null if no ancestor Route
  const matchingChildren = useMatchingChildren();
  const isMatching = matchingChildren.useIsMatching(); // reactive, re-renders only when boolean flips
  const hasProbedRef = useRef(false);
  const isProbing = !hasProbedRef.current;
  const prevReportedRef = useRef(false);
  const [, forceRender] = useReducer((n) => n + 1, 0);

  // Probe effect: fires bottom-up, so child containers report to us before we run.
  // We immediately report to our parent so parent's probe effect sees an up-to-date count.
  useLayoutEffect(() => {
    hasProbedRef.current = true;
    debug(
      `Route "${id}" probed with ${matchingChildren.getCount()} matching children`,
    );
    if (matchingSiblings && matchingChildren.getCount() > 0) {
      prevReportedRef.current = true;
      matchingSiblings.reportMatch();
    }
    forceRender();
    return () => {
      if (prevReportedRef.current) {
        prevReportedRef.current = false;
        matchingSiblings.reportUnmatch();
      }
    };
  }, []);

  // Post-probe: sync report when isMatching changes.
  useLayoutEffect(() => {
    if (!matchingSiblings) return;
    if (!hasProbedRef.current) return; // still in probe phase, handled above
    if (isMatching === prevReportedRef.current) return;
    if (isMatching) {
      prevReportedRef.current = true;
      matchingSiblings.reportMatch();
    } else {
      prevReportedRef.current = false;
      matchingSiblings.reportUnmatch();
    }
  }, [isMatching]);

  if (!isProbing && !isMatching) {
    return null;
  }
  return (
    <MatchingChildrenContext.Provider value={matchingChildren}>
      <ProbingContext.Provider value={isProbing}>
        {children}
      </ProbingContext.Provider>
    </MatchingChildrenContext.Provider>
  );
};

const RouteOnly = (props) => {
  const isProbing = useContext(ProbingContext);
  const matchingSiblings = useMatchingSiblingsContext();
  const { route, routeParams } = props;
  const { matching } = useRouteStatus(route);
  const isMatching =
    matching && (!routeParams || route.matchesParams(routeParams));
  const matchingChildren = useMatchingChildren();

  debug(
    `Route "${route.urlPattern}" isMatching: ${isMatching}, isProbing: ${isProbing}`,
  );

  useLayoutEffect(() => {
    if (!isMatching) {
      return null;
    }
    matchingSiblings.reportMatch();
    return () => {
      matchingSiblings.reportUnmatch();
    };
  }, [isMatching]);

  useUITransitionContentId(route.urlPattern);

  if (!isMatching) {
    return null;
  }
  // During probe: already reported the match, don't put content in DOM yet.
  if (isProbing) {
    return null;
  }
  return (
    <MatchingChildrenContext.Provider value={matchingChildren}>
      <RouteMatching {...props} />
    </MatchingChildrenContext.Provider>
  );
};

const RouteWithFallback = (props) => {
  const isProbing = useContext(ProbingContext);
  const matchingSiblings = useMatchingSiblingsContext();
  const siblingIsMatching = matchingSiblings.useIsMatching();
  const { route, routeParams } = props;
  const { matching } = useRouteStatus(route);
  const isMatching =
    matching && (!routeParams || route.matchesParams(routeParams));
  const matchingChildren = useMatchingChildren();

  useUITransitionContentId(route.urlPattern);

  if (isProbing) {
    return null;
  }
  if (siblingIsMatching) {
    return null;
  }
  if (!isMatching) {
    return null;
  }
  return (
    <MatchingChildrenContext.Provider value={matchingChildren}>
      <RouteMatching {...props} />
    </MatchingChildrenContext.Provider>
  );
};

const FallbackOnly = (props) => {
  const isProbing = useContext(ProbingContext);
  const matchingSiblings = useMatchingSiblingsContext();
  const siblingIsMatching = matchingSiblings.useIsMatching();
  const matchingChildren = useMatchingChildren();

  if (isProbing) {
    return null;
  }
  if (siblingIsMatching) {
    return null;
  }
  return (
    <MatchingChildrenContext.Provider value={matchingChildren}>
      <RouteMatching {...props} />
    </MatchingChildrenContext.Provider>
  );
};

const RouteInfoContext = createContext(null);
const RouteMatching = ({ route, element, action, meta, children }) => {
  const renderedElement = action ? (
    <ActionRenderer action={action}>{element}</ActionRenderer>
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
