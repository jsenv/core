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
let matchingChildrenIdCounter = 0;
const createMatchingChildren = () => {
  const trackerId = matchingChildrenIdCounter++;
  let count = 0;
  const isMatchingSignal = signal(false);
  let probing = true;

  return {
    trackerId,
    endProbe: () => {
      debug(
        `[tracker ${trackerId}] endProbe, count=${count}, setting signal to ${count > 0}`,
      );
      probing = false;
      isMatchingSignal.value = count > 0;
    },
    useIsMatching: () => isMatchingSignal.value,
    getCount: () => count,
    reportMatch: () => {
      count++;
      debug(
        `[tracker ${trackerId}] reportMatch, count now ${count}, probing=${probing}`,
      );
      if (!probing && count === 1) isMatchingSignal.value = true;
    },
    reportUnmatch: () => {
      count--;
      debug(
        `[tracker ${trackerId}] reportUnmatch, count now ${count}, probing=${probing}`,
      );
      if (!probing && count === 0) isMatchingSignal.value = false;
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

const HIDDEN_STYLE = { display: "none" };

const RouteAsContainer = ({ id, children }) => {
  const matchingSiblings = useContext(MatchingChildrenContext); // null if no ancestor Route
  const matchingChildren = useMatchingChildren();
  const isMatching = matchingChildren.useIsMatching(); // reactive, re-renders only when boolean flips
  const hasProbedRef = useRef(false);
  const isProbing = !hasProbedRef.current;
  const prevReportedRef = useRef(false);
  const [renderCount, forceRender] = useReducer((n) => n + 1, 0);

  debug(
    `[container "${id}"] RENDER #${renderCount}, isProbing=${isProbing}, isMatching=${isMatching}, ` +
      `ownTracker=${matchingChildren.trackerId}, parentTracker=${matchingSiblings ? matchingSiblings.trackerId : "none"}, ` +
      `childCount=${matchingChildren.getCount()}`,
  );

  // Probe effect: fires once on mount, bottom-up after children have reported.
  // endProbe() finalizes the count and enables signal updates for dynamic changes.
  useLayoutEffect(() => {
    hasProbedRef.current = true;
    const childCount = matchingChildren.getCount();
    debug(
      `[container "${id}"] PROBE EFFECT, childCount=${childCount}, parentTracker=${matchingSiblings ? matchingSiblings.trackerId : "none"}`,
    );
    if (matchingSiblings && childCount > 0) {
      debug(
        `[container "${id}"] reporting match to parent tracker ${matchingSiblings.trackerId}`,
      );
      prevReportedRef.current = true;
      matchingSiblings.reportMatch();
    }
    matchingChildren.endProbe();
    debug(`[container "${id}"] calling forceRender`);
    forceRender();
    return () => {
      debug(`[container "${id}"] PROBE CLEANUP`);
      if (prevReportedRef.current) {
        prevReportedRef.current = false;
        matchingSiblings.reportUnmatch();
      }
    };
  }, []);

  // Post-probe: sync report to parent when isMatching changes.
  // Skip the first run — the probe effect above already handled the initial report.
  const didMountRef = useRef(false);
  useLayoutEffect(() => {
    if (!didMountRef.current) {
      debug(
        `[container "${id}"] ISMATCHING EFFECT (mount), skipping — probe handled it`,
      );
      didMountRef.current = true;
      return;
    }
    debug(
      `[container "${id}"] ISMATCHING EFFECT, isMatching=${isMatching}, prevReported=${prevReportedRef.current}, ` +
        `parentTracker=${matchingSiblings ? matchingSiblings.trackerId : "none"}`,
    );
    if (!matchingSiblings) {
      debug(`[container "${id}"] no parent, skipping report`);
      return;
    }
    if (isMatching === prevReportedRef.current) {
      debug(
        `[container "${id}"] isMatching unchanged (${isMatching}), skipping report`,
      );
      return;
    }
    if (isMatching) {
      debug(`[container "${id}"] post-probe reporting match to parent`);
      prevReportedRef.current = true;
      matchingSiblings.reportMatch();
    } else {
      debug(`[container "${id}"] post-probe reporting unmatch to parent`);
      prevReportedRef.current = false;
      matchingSiblings.reportUnmatch();
    }
  }, [isMatching]);

  // During probe: render children with ProbingContext=true (routes return null, report via effects).
  // After probe: always render children to keep routes mounted for reactive reporting.
  // When not matching, wrap in display:none so layout shells stay hidden.
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
  if (isMatching) {
    debug(`[container "${id}"] rendering children, isMatching=true`);
    return (
      <MatchingChildrenContext.Provider value={matchingChildren}>
        <ProbingContext.Provider value={false}>
          {children}
        </ProbingContext.Provider>
      </MatchingChildrenContext.Provider>
    );
  }
  debug(`[container "${id}"] rendering children hidden (not matching)`);
  return (
    <div style={HIDDEN_STYLE}>
      <MatchingChildrenContext.Provider value={matchingChildren}>
        <ProbingContext.Provider value={false}>
          {children}
        </ProbingContext.Provider>
      </MatchingChildrenContext.Provider>
    </div>
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
    `[route "${route.urlPattern}"] RENDER, isMatching=${isMatching}, isProbing=${isProbing}, ` +
      `parentTracker=${matchingSiblings.trackerId}`,
  );

  useLayoutEffect(() => {
    debug(
      `[route "${route.urlPattern}"] EFFECT, isMatching=${isMatching}, parentTracker=${matchingSiblings.trackerId}`,
    );
    if (!isMatching) {
      debug(`[route "${route.urlPattern}"] not matching, no report`);
      return null;
    }
    debug(
      `[route "${route.urlPattern}"] calling reportMatch on tracker ${matchingSiblings.trackerId}`,
    );
    matchingSiblings.reportMatch();
    return () => {
      debug(
        `[route "${route.urlPattern}"] CLEANUP, calling reportUnmatch on tracker ${matchingSiblings.trackerId}`,
      );
      matchingSiblings.reportUnmatch();
    };
  }, [isMatching]);

  useUITransitionContentId(route.urlPattern);

  if (!isMatching) {
    debug(`[route "${route.urlPattern}"] returning null (not matching)`);
    return null;
  }
  if (isProbing) {
    debug(`[route "${route.urlPattern}"] returning null (probing)`);
    return null;
  }
  debug(`[route "${route.urlPattern}"] rendering content`);
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
  const Element = element;
  const renderedElement = action ? (
    <ActionRenderer action={action}>{element}</ActionRenderer>
  ) : typeof element === "function" ? (
    <Element />
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
