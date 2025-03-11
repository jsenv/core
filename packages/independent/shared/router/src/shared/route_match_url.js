import { createResourcePattern } from "./resource_pattern.js";

export const routeMatchUrl = (resourcePattern, url) => {
  const { match } = createResourcePattern(resourcePattern);
  return match(url);
};
