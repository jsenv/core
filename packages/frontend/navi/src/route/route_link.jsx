import { Link } from "../components/text/link.jsx";
import { useRouteStatus } from "./route.js";

export const RouteLink = ({
  route,
  routeParams,
  active,
  children,
  ...rest
}) => {
  if (!route) {
    throw new Error("route prop is required");
  }
  const routeStatus = useRouteStatus(route);
  const url = route.buildUrl(routeParams);
  const innerActive = active || routeStatus.active;

  return (
    <Link
      {...rest}
      href={url}
      pseudoState={{
        ":active": innerActive,
      }}
    >
      {children}
    </Link>
  );
};
