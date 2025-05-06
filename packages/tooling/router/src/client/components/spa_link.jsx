import { useRouteUrl } from "../route/route_hooks.js";

export const SPALink = ({ route, routeParams, children, ...rest }) => {
  const routeUrl = useRouteUrl(route, routeParams);

  return (
    <a href={routeUrl} {...rest}>
      {children}
    </a>
  );
};
