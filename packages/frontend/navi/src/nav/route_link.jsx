import { Link } from "./link.jsx";
import { useRouteStatus } from "./route.js";

export const RouteLink = ({ route, routeParams, children, ...rest }) => {
  if (!route) {
    throw new Error("route prop is required");
  }
  const routeStatus = useRouteStatus(route);
  const url = route.buildUrl(routeParams);

  let isCurrent;
  if (routeStatus.exactMatching) {
    isCurrent = true;
  } else if (routeStatus.matching) {
    isCurrent = routeParams ? route.matchesParams(routeParams) : false;
  } else {
    isCurrent = false;
  }

  return (
    <Link
      {...rest}
      href={url}
      pseudoState={{
        ":-navi-href-current": isCurrent,
      }}
    >
      {children || route.buildRelativeUrl(routeParams)}
    </Link>
  );
};
