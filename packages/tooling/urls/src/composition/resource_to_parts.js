import { pathnameToExtension } from "../internal/pathname_to_extension.js";

export const resourceToParts = (resource) => {
  const searchSeparatorIndex = resource.indexOf("?");
  if (searchSeparatorIndex === -1) {
    const hashSeparatorIndex = resource.indexOf("#");
    if (hashSeparatorIndex === -1) {
      return [resource, "", ""];
    }
    const beforeHashSeparator = resource.slice(0, hashSeparatorIndex);
    const afterHashSeparator = resource.slice(hashSeparatorIndex + 1);
    return [beforeHashSeparator, "", afterHashSeparator];
  }
  const beforeSearchSeparator = resource.slice(0, searchSeparatorIndex);
  const afterSearchSeparator = resource.slice(searchSeparatorIndex + 1);
  const hashSeparatorIndex = afterSearchSeparator.indexOf("#");
  if (hashSeparatorIndex === -1) {
    return [beforeSearchSeparator, afterSearchSeparator, ""];
  }
  const afterSearchSeparatorAndBeforeHashSeparator = afterSearchSeparator.slice(
    0,
    hashSeparatorIndex,
  );
  const afterHashSeparator = afterSearchSeparator.slice(hashSeparatorIndex + 1);
  return [
    beforeSearchSeparator,
    afterSearchSeparatorAndBeforeHashSeparator,
    afterHashSeparator,
  ];
};

export const resourceToPathname = (resource) => {
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

export const resourceToExtension = (resource) => {
  const pathname = resourceToPathname(resource);
  return pathnameToExtension(pathname);
};
