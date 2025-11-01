import { useRouteStatus } from "./route.js";

export const RouteLink = ({ route, routeParams, children }) => {
  const { active } = useRouteStatus(route);
  const url = route.buildUrl(routeParams);

  return (
    <a href={url} data-active={active ? "" : undefined}>
      {children}
    </a>
  );
};
