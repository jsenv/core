import { objectMap, objectFilter } from "../objectHelper.js"

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
  objectMap(imports, (pathnameMatchPattern, pathnameRemapPattern) => {
    return {
      [`${pathnameMatchPattern}`]: `${prefix}${pathnameRemapPattern}`,
    }
  })

const prefixScopes = (scopes, prefix) =>
  objectMap(scopes, (pathnamePattern, scopeImports) => {
    const prefixedPathnamePattern = `${prefix}${pathnamePattern}`

    scopeImports = objectFilter(scopeImports, (scopedPathnamePattern) => {
      return scopedPathnamePattern !== pathnamePattern
    })

    return {
      [prefixedPathnamePattern]: {
        ...prefixImports(scopeImports, prefix),
        [prefixedPathnamePattern]: prefixedPathnamePattern,
        "/": prefixedPathnamePattern,
      },
    }
  })
