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
  if (import.meta.dev && (props.currentExcept || props.currentAlso)) {
    console.warn(
      `currentExcept/currentAlso amend what the button's own route says about being current, so they need a "route" prop.`,
    );
  }
  return <Next {...props} />;
};

const ButtonWithRoute = (props) => {
  const Next = useNextResolver();
  // `href` is kept out of `rest`: spread after the route's url, an
  // `href={undefined}` riding along would erase it.
  const {
    route,
    routeParams,
    current,
    currentExcept,
    currentAlso,
    children,
    pseudoState,
    href,
    ...rest
  } = props;
  if (import.meta.dev) {
    assertRoute(route);
    if (href !== undefined) {
      console.warn(
        `A button with a "route" ignores its "href" (${href}): the route builds the address.`,
      );
    }
    for (const amendingRoute of [currentExcept, currentAlso].flat()) {
      if (amendingRoute) {
        assertRoute(amendingRoute);
      }
    }
  }
  const url = route.buildUrl(routeParams);
  // What a route Link reads, with the same amendments (see link.jsx).
  const linkMatching = useRouteCurrent(route, routeParams, {
    except: currentExcept,
    also: currentAlso,
  });

  // Merged into whatever the caller already holds: a button can be forced into
  // a state for a demo and still learn its own current-ness from its route.
  return (
    <Next
      href={url}
      pseudoState={{
        ...pseudoState,
        ":-navi-href-current": current ?? linkMatching,
      }}
      {...rest}
    >
      {children || route.buildRelativeUrl(routeParams)}
    </Next>
  );
};
