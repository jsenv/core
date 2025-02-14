import { escapeRegexpSpecialChars } from "@jsenv/utils/src/string/escape_regexp_special_chars.js";

export const convertRouteUrlIntoRegexp = (urlPattern) => {
  const patternUrlObject = new URL(urlPattern, "http://example.com");
  const patternPathname = patternUrlObject.pathname;
  let regexpSource = "";
  let lastIndex = 0;
  for (const match of patternPathname.matchAll(/:\w+/g)) {
    const [string, index] = match;
    let before = patternPathname.slice(0, index - string.length);
    regexpSource += escapeRegexpSpecialChars(before);
    regexpSource += `(?<${string.slice(1)}>[^/]+)`;
    lastIndex = index;
  }
  const after = patternPathname.slice(lastIndex);
  regexpSource += escapeRegexpSpecialChars(after);
  return new RegExp(regexpSource);
};
