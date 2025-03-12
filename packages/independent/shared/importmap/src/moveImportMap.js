import { assertImportMap } from "./internal/assertImportMap.js"
import { urlToRelativeUrl } from "./internal/urlToRelativeUrl.js"
import { resolveUrl } from "./resolveUrl.js"
import { resolveSpecifier } from "./resolveSpecifier.js"
import { hasScheme } from "./internal/hasScheme.js"

export const moveImportMap = (importMap, fromUrl, toUrl) => {
  assertImportMap(importMap)

  const makeRelativeTo = (value, type) => {
    let url
    if (type === "specifier") {
      url = resolveSpecifier(value, fromUrl)
      if (!url) {
        // bare specifier
        return value
      }
    } else {
      url = resolveUrl(value, fromUrl)
    }

    const relativeUrl = urlToRelativeUrl(url, toUrl)
    if (relativeUrl.startsWith("../")) {
      return relativeUrl
    }
    if (relativeUrl.startsWith("./")) {
      return relativeUrl
    }
    if (hasScheme(relativeUrl)) {
      return relativeUrl
    }
    return `./${relativeUrl}`
  }

  const importMapRelative = {}
  const { imports } = importMap
  if (imports) {
    importMapRelative.imports =
      makeMappingsRelativeTo(imports, makeRelativeTo) || imports
  }

  const { scopes } = importMap
  if (scopes) {
    importMapRelative.scopes =
      makeScopesRelativeTo(scopes, makeRelativeTo) || scopes
  }

  // nothing changed
  if (
    importMapRelative.imports === imports &&
    importMapRelative.scopes === scopes
  ) {
    return importMap
  }
  return importMapRelative
}

const makeMappingsRelativeTo = (mappings, makeRelativeTo) => {
  const mappingsTransformed = {}
  const mappingsRemaining = {}
  let transformed = false
  Object.keys(mappings).forEach((specifier) => {
    const address = mappings[specifier]
    const specifierRelative = makeRelativeTo(specifier, "specifier")
    const addressRelative = makeRelativeTo(address, "address")

    if (specifierRelative) {
      transformed = true
      mappingsTransformed[specifierRelative] = addressRelative || address
    } else if (addressRelative) {
      transformed = true
      mappingsTransformed[specifier] = addressRelative
    } else {
      mappingsRemaining[specifier] = address
    }
  })
  return transformed ? { ...mappingsTransformed, ...mappingsRemaining } : null
}

const makeScopesRelativeTo = (scopes, makeRelativeTo) => {
  const scopesTransformed = {}
  const scopesRemaining = {}
  let transformed = false
  Object.keys(scopes).forEach((scopeSpecifier) => {
    const scopeMappings = scopes[scopeSpecifier]
    const scopeSpecifierRelative = makeRelativeTo(scopeSpecifier, "address")
    const scopeMappingsRelative = makeMappingsRelativeTo(
      scopeMappings,
      makeRelativeTo,
    )

    if (scopeSpecifierRelative) {
      transformed = true
      scopesTransformed[scopeSpecifierRelative] =
        scopeMappingsRelative || scopeMappings
    } else if (scopeMappingsRelative) {
      transformed = true
      scopesTransformed[scopeSpecifier] = scopeMappingsRelative
    } else {
      scopesRemaining[scopeSpecifier] = scopeMappingsRelative
    }
  })
  return transformed ? { ...scopesTransformed, ...scopesRemaining } : null
}
