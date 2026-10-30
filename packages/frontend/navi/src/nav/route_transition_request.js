/*
 * What ONE navigation asks of a route transition, worn by the element being
 * pressed: `<Link routeTransition>`, `<Button routeTransition>`, or the
 * attribute by hand on any anchor. A type travels as its name — all most
 * presses have to say — and anything more (a way round, a pace) as the same
 * object navTo() takes, written as JSON.
 *
 * Apart from route_transition.jsx, which plays the request: the press handlers
 * and the --navi-nav-to command read it too, and importing the transition
 * machinery there would pull it into an application that defines no
 * transition.
 */

const ROUTE_TRANSITION_REQUEST_ATTRIBUTE = "data-navi-route-transition-request";

// The attributes to spread on the element. Nothing when nothing is asked, so
// that the attribute written by hand on the same element is left standing.
export const writeRouteTransitionRequest = (routeTransition) => {
  if (routeTransition === undefined || routeTransition === null) {
    return null;
  }
  return {
    [ROUTE_TRANSITION_REQUEST_ATTRIBUTE]:
      typeof routeTransition === "string"
        ? routeTransition
        : JSON.stringify(routeTransition),
  };
};

// The request as navTo() takes it — a type name or the object — and undefined
// when the element asks nothing.
export const readRouteTransitionRequest = (element) => {
  const asked = element.getAttribute(ROUTE_TRANSITION_REQUEST_ATTRIBUTE);
  if (asked === null) {
    return undefined;
  }
  const value = asked.trim();
  if (value === "") {
    return undefined;
  }
  if (value[0] !== "{") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    console.warn(
      `${ROUTE_TRANSITION_REQUEST_ATTRIBUTE} is neither a type name nor JSON: ${value}`,
    );
    return undefined;
  }
};
