export const resourceToParts = (resource) => {
  const searchSeparatorIndex = resource.indexOf("?");
  if (searchSeparatorIndex === -1) {
    const hashIndex = resource.indexOf("#");
    if (hashIndex === -1) {
      return [resource, "", ""];
    }
    const pathname = resource.slice(0, hashIndex);
    const hash = resource.slice(hashIndex);
    return [pathname, "", hash];
  }
  const beforeSearch = resource.slice(0, searchSeparatorIndex);
  const afterSearch = resource.slice(searchSeparatorIndex);
  const hashIndex = afterSearch.indexOf("#");
  if (hashIndex === -1) {
    return [beforeSearch, afterSearch, ""];
  }
  const search = afterSearch.slice(0, hashIndex);
  const hash = afterSearch.slice(hashIndex);
  return [beforeSearch, search, hash];
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
