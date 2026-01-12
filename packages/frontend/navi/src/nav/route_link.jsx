import { Link } from "./link.jsx";
import { useRouteStatus } from "./route.js";

export const RouteLink = ({ route, routeParams, children, ...rest }) => {
  if (!route) {
    throw new Error("route prop is required");
  }
  const routeStatus = useRouteStatus(route);
  const url = route.buildUrl(routeParams);
  const paramsAreMatching = route.matchesParams(routeParams);

  return (
    <Link
      {...rest}
      href={url}
      pseudoState={{
        ":-navi-href-current": paramsAreMatching
          ? routeStatus.matching
          : routeStatus.exactMatching,
      }}
    >
      {children || route.buildRelativeUrl(routeParams)}
    </Link>
  );
};
