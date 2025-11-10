import { Link } from "../components/text/link.jsx";
import { useRouteStatus } from "./route.js";

export const RouteLink = ({ route, routeParams, children, ...rest }) => {
  if (!route) {
    throw new Error("route prop is required");
  }
  const routeStatus = useRouteStatus(route);
  const url = route.buildUrl(routeParams);
  const routeIsActive = routeStatus.active;

  return (
    <Link
      {...rest}
      href={url}
      pseudoState={{
        ":-navi-current": routeIsActive,
      }}
    >
      {children}
    </Link>
  );
};
