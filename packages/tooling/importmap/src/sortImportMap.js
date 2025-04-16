import { assertImportMap } from "./internal/assertImportMap.js"

export const sortImportMap = (importMap) => {
  assertImportMap(importMap)

  const { imports, scopes } = importMap

  return {
    ...(imports ? { imports: sortImports(imports) } : {}),
    ...(scopes ? { scopes: sortScopes(scopes) } : {}),
  }
}

export const sortImports = (imports) => {
  const mappingsSorted = {}

  Object.keys(imports)
    .sort(compareLengthOrLocaleCompare)
    .forEach((name) => {
      mappingsSorted[name] = imports[name]
    })

  return mappingsSorted
}

export const sortScopes = (scopes) => {
  const scopesSorted = {}

  Object.keys(scopes)
    .sort(compareLengthOrLocaleCompare)
    .forEach((scopeSpecifier) => {
      scopesSorted[scopeSpecifier] = sortImports(scopes[scopeSpecifier])
    })

  return scopesSorted
}

const compareLengthOrLocaleCompare = (a, b) => {
  return b.length - a.length || a.localeCompare(b)
}
