import { escapeRegexpSpecialChars } from "@jsenv/utils/src/string/escape_regexp_special_chars.js";

export const parseResourcePattern = (resourcePattern) => {
  if (resourcePattern === "*") {
    return {
      regexp: /.*/,
      match: () => true,
      build: (url) => url,
    };
  }
  let regexpSource = "";
  let lastIndex = 0;
  regexpSource += "^";
  let starIndex = 0;
  for (const match of resourcePattern.matchAll(/:\w+|\*/g)) {
    const string = match[0];
    const index = match.index;
    let before = resourcePattern.slice(lastIndex, index);
    regexpSource += escapeRegexpSpecialChars(before);
    if (string === "*") {
      regexpSource += `(?<star_${starIndex}>.+)`;
      starIndex++;
    } else {
      regexpSource += `(?<${string.slice(1)}>[^\/]+)`;
    }

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
      const groups = match.groups;
      if (groups && Object.keys(groups).length) {
        const stars = [];
        const named = {};
        for (const key of Object.keys(groups)) {
          if (key.startsWith("star_")) {
            const index = parseInt(key.slice("star_".length));
            stars[index] = groups[key];
          } else {
            named[key] = groups[key];
          }
        }
        return { named, stars };
      }
      return { named: {}, stars: [] };
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
