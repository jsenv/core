import { comparePathnames } from "./compare_pathnames.js";

export const compareFileUrls = (a, b) => {
  return comparePathnames(new URL(a).pathname, new URL(b).pathname);
};
