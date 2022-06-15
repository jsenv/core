import { ensureUrlTrailingSlash } from "./internal/ensureUrlTrailingSlash.js"
import { resolveUrl } from "./resolveUrl.js"

export const resolveDirectoryUrl = (specifier, baseUrl) => {
  const url = resolveUrl(specifier, baseUrl)
  return ensureUrlTrailingSlash(url)
}
