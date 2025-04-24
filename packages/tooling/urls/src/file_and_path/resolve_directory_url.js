import { ensurePathnameTrailingSlash } from "../composition/set_url_part.js";
import { resolveUrl } from "./resolve_url.js";

export const resolveDirectoryUrl = (specifier, baseUrl) => {
  const url = resolveUrl(specifier, baseUrl);
  return ensurePathnameTrailingSlash(url);
};
