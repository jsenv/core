import { urlToResource } from "./url_to_resource.js";

export const urlToPathname = (url) => {
  const resource = urlToResource(url);
  const pathname = resourceToPathname(resource);
  return pathname;
};

const resourceToPathname = (resource) => {
  const searchSeparatorIndex = resource.indexOf("?");
  if (searchSeparatorIndex > -1) {
    return resource.slice(0, searchSeparatorIndex);
  }
  const hashIndex = resource.indexOf("#");
  if (hashIndex > -1) {
    return resource.slice(0, hashIndex);
  }
  return resource;
};
