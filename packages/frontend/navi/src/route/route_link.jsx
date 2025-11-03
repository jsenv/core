import { Link } from "../components/link/link.jsx";
import { useRouteStatus } from "./route.js";

export const RouteLink = ({ route, routeParams, children, ...rest }) => {
  if (!route) {
    throw new Error("RouteLink: route prop is required");
  }
  const { active } = useRouteStatus(route);
  const url = route.buildUrl(routeParams);

  return (
    <Link {...rest} href={url} active={active ? "" : undefined}>
      {children}
    </Link>
  );
};
