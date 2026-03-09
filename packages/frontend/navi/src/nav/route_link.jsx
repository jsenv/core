import { Link } from "./link.jsx";
import { useRouteStatus } from "./route.js";

export const RouteLink = ({ route, routeParams, children, ...rest }) => {
  if (!route) {
    throw new Error("route prop is required");
  }
  const { matching } = useRouteStatus(route);
  const paramsAreMatching = route.matchesParams(routeParams);
  const url = route.buildUrl(routeParams);

  return (
    <Link matching={matching && paramsAreMatching} href={url} {...rest}>
      {children || route.buildRelativeUrl(routeParams)}
    </Link>
  );
};
