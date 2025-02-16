import { escapeRegexpSpecialChars } from "@jsenv/utils/src/string/escape_regexp_special_chars.js";

export const parseRouteUrl = (urlPattern, baseUrl) => {
  const resourcePattern = resourceFromUrl(urlPattern, baseUrl);
  let regexpSource = "";
  let lastIndex = 0;
  regexpSource += "^";
  for (const match of resourcePattern.matchAll(/:\w+/g)) {
    const string = match[0];
    const index = match.index;
    let before = resourcePattern.slice(0, index);
    regexpSource += escapeRegexpSpecialChars(before);
    regexpSource += `(?<${string.slice(1)}>[^\/]+)`;
    lastIndex = index + string.length;
  }
  const after = resourcePattern.slice(lastIndex);
  regexpSource += escapeRegexpSpecialChars(after);
  regexpSource += "$";

  const regexp = new RegExp(regexpSource);
  return {
    regexp,
    match: (url) => {
      const resource = resourceFromUrl(url);
      const match = resource.match(regexp);
      if (!match) {
        return null;
      }
      return match.groups || true;
    },
    build: (url, params) => {
      const urlToReplace = new URL(resourcePattern, url);
      const ressourceToReplace = resourceFromUrl(urlToReplace);
      const resourceWithValues = ressourceToReplace.replaceAll(
        /:\w+/g,
        (match) => {
          const key = match.slice(1);
          const value = params[key];
          return encodeURIComponent(value);
        },
      );
      const urlWithValues = new URL(resourceWithValues, url).href;
      return urlWithValues;
    },
  };
};

const resourceFromUrl = (url, baseUrl = "http://example.com") => {
  url = String(url);
  if (url[0] === "/") {
    url = url.slice(1);
  }
  // if (url[0] !== "/") url = `/${url}`;
  const urlObject = new URL(url, baseUrl);
  const resource = urlObject.href.slice(urlObject.origin.length);
  return resource;
};
