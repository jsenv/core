import { parseResourcePattern } from "./resource_pattern.js";

export const routeMatchUrl = (resourcePattern, url) => {
  const { match } = parseResourcePattern(resourcePattern);
  return match(url);
};
