import { Link } from "./link.jsx";
import { useRouteStatus } from "./route.js";

// en gros ici ce qu'on veut c'est:
// que si on précie pas les params on se permet d'hériter ceux qu'on trouve dans l'url courante
// attention pas que en fait. On aurait aussi des params dans le local storage
// pour garder l'état d'autres parties de l'app pas visible actuellement
// et il faut aussi un moyen de dire quelle params sont propres a quelle route
// pour qu'un route donnée n'utilise que les params dont elle a besoin
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
