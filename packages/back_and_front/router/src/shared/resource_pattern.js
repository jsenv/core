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
    const searchParams = Object.fromEntries(
      new URLSearchParams(searchPatternString),
    );
    searchPattern = PATTERN.createKeyValue(searchParams);
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
      let result = pathnamePattern.match(pathname);
      if (!result) {
        return null;
      }

      let searchResult;
      let hashResult;
      if (searchPattern) {
        const searchParams = Object.fromEntries(new URLSearchParams(search));
        searchResult = searchPattern.match(searchParams);
        if (!searchResult) {
          return null;
        }
        if (result.named) {
          Object.assign(result.named, searchResult);
        } else {
          result.named = searchResult;
        }
      }
      if (hashPattern) {
        hashResult = hashPattern.match(hash);
        if (!hashResult) {
          return null;
        }
        result = PATTERN.composeTwoMatchResults(result, hashResult);
      }
      return result;
    },
    generate: (...args) => {
      let resource = "";
      resource += pathnamePattern.generate(...args);
      if (searchPatternString) {
        const generatedSearchParams = searchPattern.generate(args[0]);
        const searchParams = new URLSearchParams();
        for (const key of Object.keys(generatedSearchParams)) {
          searchParams.set(key, generatedSearchParams[key]);
        }
        const search = searchParams.toString();
        resource += `?${search}`;
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
