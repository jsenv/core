import { Link } from "./link.jsx";
import { useRouteStatus } from "./route.js";

export const RouteLink = ({ route, routeParams, children, ...rest }) => {
  if (!route) {
    throw new Error("route prop is required");
  }
  const routeStatus = useRouteStatus(route);
  const url = route.buildUrl(routeParams);
  const active = routeStatus.active;
  const paramsAreMatching = route.compareParams(routeParams);

  return (
    <Link
      {...rest}
      href={url}
      pseudoState={{
        ":-navi-href-current": active && paramsAreMatching,
      }}
    >
      {children}
    </Link>
  );
};
