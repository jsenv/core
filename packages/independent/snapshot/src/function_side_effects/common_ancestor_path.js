import { getCommonPathname } from "@jsenv/urls/src/common_pathname.js";

export const findCommonAncestorPath = (paths, castAsPath) => {
  return paths.reduce((a, b) => {
    if (typeof a !== "string" && castAsPath) a = castAsPath(a);
    if (typeof b !== "string" && castAsPath) b = castAsPath(b);
    if (a === b) {
      return a;
    }
    const common = getCommonPathname(a, b);
    return common;
  });
};
