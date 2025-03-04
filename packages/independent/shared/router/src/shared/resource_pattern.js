import { resourceToParts } from "@jsenv/urls";
import { PATTERN } from "./pattern.js";

export const createResourcePattern = (pattern) => {
  const [pathnamePatternString, searchPatternString, hashPatternString] =
    resourceToParts(pattern);

  const pathnamePattern = PATTERN.create(pathnamePatternString, {
    namedGroupDelimiter: "/",
  });
  let searchPattern;
  if (searchPatternString) {
    searchPattern = PATTERN.create(searchPatternString, {
      namedGroupDelimiter: "&",
    });
  }
  let hashPattern;
  if (hashPatternString) {
    hashPattern = PATTERN.create(hashPatternString, {
      namedGroupDelimiter: "&",
    });
  }

  return {
    match: (resource) => {
      const [pathname, search, hash] = resourceToParts(resource);
      const pathnameResult = pathnamePattern.match(pathname);
      if (!pathnameResult) {
        return null;
      }

      let searchResult;
      let hashResult;
      if (searchPattern) {
        searchResult = searchPattern.match(search);
        if (!searchResult) {
          return null;
        }
      }
      if (hashPattern) {
        hashResult = hashPattern.match(hash);
        if (!hashResult) {
          return null;
        }
      }
      let result = pathnameResult;
      if (searchResult) {
        result = PATTERN.composeTwoMatchResults(result, searchResult);
      }
      if (hashResult) {
        result = PATTERN.composeTwoMatchResults(result, hashResult);
      }
      return result;
    },
    generate: (...args) => {
      let resource = "";
      resource += pathnamePattern.generate(...args);
      if (searchPatternString) {
        resource += `?${searchPattern.generate(args[0])}`;
      }
      if (hashPatternString) {
        resource += `#${hashPattern.generate(args[0])}`;
      }
      return resource;
    },
    generateExample: () => {
      let resourceExample = "";
      resourceExample += pathnamePattern.generateExample();
      if (searchPatternString) {
        resourceExample += `?${searchPattern.generateExample()}`;
      }
      if (hashPatternString) {
        resourceExample += `#${hashPattern.generateExample()}`;
      }
      return resourceExample;
    },
  };
};

// const resourceFromUrl = (url, baseUrl = "http://example.com") => {
//   url = String(url);
//   if (url[0] === "/") {
//     url = url.slice(1);
//   }
//   // if (url[0] !== "/") url = `/${url}`;
//   const urlObject = new URL(url, baseUrl);
//   const resource = urlObject.href.slice(urlObject.origin.length);
//   return resource;
// };
