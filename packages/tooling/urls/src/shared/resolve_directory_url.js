import { resolveUrl } from "./resolve_url.js";
import { ensurePathnameTrailingSlash } from "./set_url_part.js";

export const resolveDirectoryUrl = (specifier, baseUrl) => {
  const url = resolveUrl(specifier, baseUrl);
  return ensurePathnameTrailingSlash(url);
};
