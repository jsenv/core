import { useContext } from "preact/hooks";

import { Link } from "./link.jsx";
import { useRouteStatus } from "./route.js";
import { ReportSelectedOnTabContext } from "./tablist/tab_context.js";

export const RouteLink = ({ route, routeParams, children, ...rest }) => {
  if (!route) {
    throw new Error("route prop is required");
  }
  const url = route.buildUrl(routeParams);
  const reportSelectedOnTab = useContext(ReportSelectedOnTabContext);
  const { matching } = useRouteStatus(route);
  const paramsAreMatching = route.matchesParams(routeParams);
  const linkMatching = matching && paramsAreMatching;

  reportSelectedOnTab?.(linkMatching);

  return (
    <Link matching={linkMatching} href={url} {...rest}>
      {children || route.buildRelativeUrl(routeParams)}
    </Link>
  );
};
