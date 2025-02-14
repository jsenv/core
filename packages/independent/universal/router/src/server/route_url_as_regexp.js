import { escapeRegexpSpecialChars } from "@jsenv/utils/src/string/escape_regexp_special_chars.js";

export const convertRouteUrlIntoRegexp = (urlPattern) => {
  const patternUrlObject = new URL(urlPattern, "http://example.com");
  const pathnamePattern = patternUrlObject.pathname;
  let regexpSource = "";
  let lastIndex = 0;
  regexpSource += "^";
  for (const match of pathnamePattern.matchAll(/:\w+/g)) {
    const string = match[0];
    const index = match.index;
    let before = pathnamePattern.slice(0, index);
    regexpSource += escapeRegexpSpecialChars(before);
    regexpSource += `(?<${string.slice(1)}>[^\/]+)`;
    lastIndex = index + string.length;
  }
  const after = pathnamePattern.slice(lastIndex);
  regexpSource += escapeRegexpSpecialChars(after);
  regexpSource += "$";
  return new RegExp(regexpSource);
};
