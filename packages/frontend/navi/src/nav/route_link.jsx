import { Link } from "./link.jsx";
import { useRouteStatus } from "./route.js";

export const RouteLink = ({ route, routeParams, children, ...rest }) => {
  if (!route) {
    throw new Error("route prop is required");
  }
  useRouteStatus(route);
  const url = route.buildUrl(routeParams);

  return (
    <Link {...rest} href={url}>
      {children || route.buildRelativeUrl(routeParams)}
    </Link>
  );
};
