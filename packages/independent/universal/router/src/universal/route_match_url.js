import { parseRouteUrl } from "./route_url_parser.js";

export const routeMatchUrl = (routeUrlPattern, url) => {
  const { match } = parseRouteUrl(routeUrlPattern);
  return match(url);
};
