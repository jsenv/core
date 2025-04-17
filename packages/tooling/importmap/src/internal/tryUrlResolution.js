import { resolveUrl } from "../resolveUrl.js";
import { hasScheme } from "./hasScheme.js";

export const tryUrlResolution = (string, url) => {
  const result = resolveUrl(string, url);
  return hasScheme(result) ? result : null;
};
