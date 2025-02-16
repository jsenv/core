import { escapeRegexpSpecialChars } from "@jsenv/utils/src/string/escape_regexp_special_chars.js";

export const parseRouteUrl = (urlPattern) => {
  const resourcePattern = resourceFromUrl(urlPattern);
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
      const urlToReplace = new URL(urlPattern, url).href;
      const urlWithValues = urlToReplace.replaceAll(/:\w+/g, (match) => {
        const key = match.slice(1);
        const value = params[key];
        return encodeURIComponent(value);
      });
      return urlWithValues;
    },
  };
};

const resourceFromUrl = (url) => {
  // if (url[0] !== "/") url = `/${url}`;
  const urlObject = new URL(url, "http://example.com");
  const resource = urlObject.href.slice(urlObject.origin.length);
  return resource;
};
