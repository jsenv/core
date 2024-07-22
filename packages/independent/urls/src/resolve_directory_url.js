import { resolveUrl } from "./resolve_url.js";
import { ensurePathnameTrailingSlash } from "./url_utils.js";

export const resolveDirectoryUrl = (specifier, baseUrl) => {
  const url = resolveUrl(specifier, baseUrl);
  return ensurePathnameTrailingSlash(url);
};
