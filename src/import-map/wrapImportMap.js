import { objectMap } from "../objectHelper.js"

export const wrapImportMap = ({ imports = {}, scopes = {} }, folderRelativeName) => {
  const prefix = `/${folderRelativeName}`
  const wrappedImportMap = {
    imports: prefixImports(imports, prefix),
    scopes: {
      ...prefixScopes(scopes, prefix),
      [`${prefix}/`]: {
        // ...prefixImports(imports, prefix),
        [`${prefix}/`]: `${prefix}/`,
        "/": `${prefix}/`,
      },
    },
  }
  return wrappedImportMap
}

const prefixImports = (imports, prefix) =>
  objectMap(imports, (pathnamePattern, remapPattern) => {
    return {
      [`${pathnamePattern}`]: `${prefix}${remapPattern}`,
    }
  })

const prefixScopes = (scopes, prefix) =>
  objectMap(scopes, (pathnamePattern, scopeImports) => {
    const prefixedPathnamePattern = `${prefix}${pathnamePattern}`

    return {
      [prefixedPathnamePattern]: {
        ...prefixScopedImport(scopeImports, prefix, pathnamePattern),
        [prefixedPathnamePattern]: prefixedPathnamePattern,
        "/": prefixedPathnamePattern,
      },
    }
  })

const prefixScopedImport = (imports, prefix, scopePathnamePattern) => {
  return objectMap(imports, (pathnamePattern, remapPattern) => {
    if (pathnamePattern === scopePathnamePattern && remapPattern === scopePathnamePattern) {
      return {
        [`${prefix}${pathnamePattern}`]: `${prefix}${pathnamePattern}`,
      }
    }

    return {
      [`${pathnamePattern}`]: `${prefix}${remapPattern}`,
    }
  })
}
