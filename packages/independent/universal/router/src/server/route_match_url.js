import { convertRouteUrlIntoRegexp } from "./route_url_as_regexp.js";

export const routeMatchUrl = (routeUrlPattern, url) => {
  const regexp = convertRouteUrlIntoRegexp(routeUrlPattern);
  const match = url.match(regexp);
  if (!match) {
    return null;
  }
  return match.groups;
};
