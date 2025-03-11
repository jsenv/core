import { resourceToPathname } from "./resource_to_parts.js";
import { urlToResource } from "./url_to_resource.js";

export const urlToPathname = (url) => {
  const resource = urlToResource(url);
  const pathname = resourceToPathname(resource);
  return pathname;
};
