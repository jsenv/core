import { convertRouteUrlIntoRegexp } from "./route_url_as_regexp.js";

export const routeMatchUrl = (routeUrlPattern, url) => {
  const regexp = convertRouteUrlIntoRegexp(routeUrlPattern);
  const urlObject = new URL(url, "http://example.com");
  const pathname = urlObject.pathname;
  const match = pathname.match(regexp);
  if (!match) {
    return null;
  }
  return match.groups || true;
};
