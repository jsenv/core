import { ensurePathnameTrailingSlash } from "./url_utils.js"
import { resolveUrl } from "./resolve_url.js"

export const resolveDirectoryUrl = (specifier, baseUrl) => {
  const url = resolveUrl(specifier, baseUrl)
  return ensurePathnameTrailingSlash(url)
}
