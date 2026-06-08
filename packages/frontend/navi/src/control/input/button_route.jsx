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
  const { route, routeParams, children, ...rest } = props;
  if (import.meta.dev) {
    assertRoute(route);
  }
  const url = route.buildUrl(routeParams);
  const { matching } = useRouteStatus(route);
  const paramsAreMatching = route.matchesParams(routeParams);
  const linkMatching = matching && paramsAreMatching;

  return (
    <Next
      href={url}
      data-href-current={linkMatching ? "" : undefined}
      {...rest}
    >
      {children || route.buildRelativeUrl(routeParams)}
    </Next>
  );
};
