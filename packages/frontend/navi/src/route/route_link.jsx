import { Link } from "../components/link/link.jsx";
import { useRouteStatus } from "./route.js";

export const RouteLink = ({ route, routeParams, children, ...rest }) => {
  const { active } = useRouteStatus(route);
  const url = route.buildUrl(routeParams);

  return (
    <Link {...rest} href={url} active={active ? "" : undefined}>
      {children}
    </Link>
  );
};
