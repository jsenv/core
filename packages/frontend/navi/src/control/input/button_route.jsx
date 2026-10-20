import { assertRoute } from "@jsenv/navi/src/nav/route.js";
import { useRouteCurrent } from "@jsenv/navi/src/nav/use_route_current.js";
import {
  renderResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";

export const ButtonRouteResolver = (props) => {
  const Next = useNextResolver();
  if (props.route) {
    return renderResolver(ButtonWithRoute, props);
  }
  return <Next {...props} />;
};

const ButtonWithRoute = (props) => {
  const Next = useNextResolver();
  // `href` is kept out of `rest`: spread after the route's url, an
  // `href={undefined}` riding along would erase it.
  const { route, routeParams, children, pseudoState, href, ...rest } = props;
  if (import.meta.dev) {
    assertRoute(route);
    if (href !== undefined) {
      console.warn(
        `A button with a "route" ignores its "href" (${href}): the route builds the address.`,
      );
    }
  }
  const url = route.buildUrl(routeParams);
  const linkMatching = useRouteCurrent(route, routeParams);

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
