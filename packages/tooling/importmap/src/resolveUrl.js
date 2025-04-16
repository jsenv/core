// could be useful: https://url.spec.whatwg.org/#url-miscellaneous

import { urlToScheme } from "./internal/urlToScheme.js"
import { urlToPathname } from "./internal/urlToPathname.js"
import { urlToOrigin } from "./internal/urlToOrigin.js"
import { pathnameToParentPathname } from "./internal/pathnameToParentPathname.js"
import { hasScheme } from "./internal/hasScheme.js"

export const resolveUrl = (specifier, baseUrl) => {
  if (baseUrl) {
    if (typeof baseUrl !== "string") {
      throw new TypeError(writeBaseUrlMustBeAString({ baseUrl, specifier }))
    }
    if (!hasScheme(baseUrl)) {
      throw new Error(writeBaseUrlMustBeAbsolute({ baseUrl, specifier }))
    }
  }

  if (hasScheme(specifier)) {
    return specifier
  }

  if (!baseUrl) {
    throw new Error(writeBaseUrlRequired({ baseUrl, specifier }))
  }

  // scheme relative
  if (specifier.slice(0, 2) === "//") {
    return `${urlToScheme(baseUrl)}:${specifier}`
  }

  // origin relative
  if (specifier[0] === "/") {
    return `${urlToOrigin(baseUrl)}${specifier}`
  }

  const baseOrigin = urlToOrigin(baseUrl)
  const basePathname = urlToPathname(baseUrl)

  if (specifier === ".") {
    const baseDirectoryPathname = pathnameToParentPathname(basePathname)
    return `${baseOrigin}${baseDirectoryPathname}`
  }

  // pathname relative inside
  if (specifier.slice(0, 2) === "./") {
    const baseDirectoryPathname = pathnameToParentPathname(basePathname)
    return `${baseOrigin}${baseDirectoryPathname}${specifier.slice(2)}`
  }

  // pathname relative outside
  if (specifier.slice(0, 3) === "../") {
    let unresolvedPathname = specifier
    const importerFolders = basePathname.split("/")
    importerFolders.pop()

    while (unresolvedPathname.slice(0, 3) === "../") {
      unresolvedPathname = unresolvedPathname.slice(3)
      // when there is no folder left to resolved
      // we just ignore '../'
      if (importerFolders.length) {
        importerFolders.pop()
      }
    }

    const resolvedPathname = `${importerFolders.join(
      "/",
    )}/${unresolvedPathname}`
    return `${baseOrigin}${resolvedPathname}`
  }

  // bare
  if (basePathname === "") {
    return `${baseOrigin}/${specifier}`
  }
  if (basePathname[basePathname.length] === "/") {
    return `${baseOrigin}${basePathname}${specifier}`
  }
  return `${baseOrigin}${pathnameToParentPathname(basePathname)}${specifier}`
}

const writeBaseUrlMustBeAString = ({
  baseUrl,
  specifier,
}) => `baseUrl must be a string.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`

const writeBaseUrlMustBeAbsolute = ({
  baseUrl,
  specifier,
}) => `baseUrl must be absolute.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`

const writeBaseUrlRequired = ({
  baseUrl,
  specifier,
}) => `baseUrl required to resolve relative specifier.
--- base url ---
${baseUrl}
--- specifier ---
${specifier}`
