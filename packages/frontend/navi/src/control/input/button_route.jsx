import { assertRoute, useRouteStatus } from "@jsenv/navi/src/nav/route.js";
import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";

export const ButtonRouteResolver = (props) => {
  const Next = useNextResolver();
  if (props.route) {
    return <ButtonWithRoute {...props} />;
  }
  return <Next {...props} />;
};

const ButtonWithRoute = (props) => {
  const Next = useNextResolver();
  const { route, routeParams, children, pseudoState, ...rest } = props;
  if (import.meta.dev) {
    assertRoute(route);
  }
  const url = route.buildUrl(routeParams);
  const { matching } = useRouteStatus(route);
  const paramsAreMatching = route.matchesParams(routeParams);
  const linkMatching = matching && paramsAreMatching;

  // Merged into whatever the caller already holds: a button can be forced into
  // a state for a demo and still learn its own current-ness from its route.
  return (
    <Next
      href={url}
      pseudoState={{ ...pseudoState, ":-navi-href-current": linkMatching }}
      {...rest}
    >
      {children || route.buildRelativeUrl(routeParams)}
    </Next>
  );
};
