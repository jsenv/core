// https://github.com/systemjs/systemjs/blob/89391f92dfeac33919b0223bbf834a1f4eea5750/src/common.js#L136
import { assertImportMap } from "./internal/assertImportMap.js"
import { resolveUrl } from "./resolveUrl.js"

export const composeTwoImportMaps = (leftImportMap, rightImportMap) => {
  assertImportMap(leftImportMap)
  assertImportMap(rightImportMap)

  const importMap = {}

  const leftImports = leftImportMap.imports
  const rightImports = rightImportMap.imports
  const leftHasImports = Boolean(leftImports)
  const rightHasImports = Boolean(rightImports)
  if (leftHasImports && rightHasImports) {
    importMap.imports = composeTwoMappings(leftImports, rightImports)
  } else if (leftHasImports) {
    importMap.imports = { ...leftImports }
  } else if (rightHasImports) {
    importMap.imports = { ...rightImports }
  }

  const leftScopes = leftImportMap.scopes
  const rightScopes = rightImportMap.scopes
  const leftHasScopes = Boolean(leftScopes)
  const rightHasScopes = Boolean(rightScopes)
  if (leftHasScopes && rightHasScopes) {
    importMap.scopes = composeTwoScopes(
      leftScopes,
      rightScopes,
      importMap.imports || {},
    )
  } else if (leftHasScopes) {
    importMap.scopes = { ...leftScopes }
  } else if (rightHasScopes) {
    importMap.scopes = { ...rightScopes }
  }

  return importMap
}

const composeTwoMappings = (leftMappings, rightMappings) => {
  const mappings = {}

  Object.keys(leftMappings).forEach((leftSpecifier) => {
    if (objectHasKey(rightMappings, leftSpecifier)) {
      // will be overidden
      return
    }
    const leftAddress = leftMappings[leftSpecifier]
    const rightSpecifier = Object.keys(rightMappings).find((rightSpecifier) => {
      return compareAddressAndSpecifier(leftAddress, rightSpecifier)
    })
    mappings[leftSpecifier] = rightSpecifier
      ? rightMappings[rightSpecifier]
      : leftAddress
  })

  Object.keys(rightMappings).forEach((rightSpecifier) => {
    mappings[rightSpecifier] = rightMappings[rightSpecifier]
  })

  return mappings
}

const objectHasKey = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key)

const compareAddressAndSpecifier = (address, specifier) => {
  const addressUrl = resolveUrl(address, "file:///")
  const specifierUrl = resolveUrl(specifier, "file:///")
  return addressUrl === specifierUrl
}

const composeTwoScopes = (leftScopes, rightScopes, imports) => {
  const scopes = {}

  Object.keys(leftScopes).forEach((leftScopeKey) => {
    if (objectHasKey(rightScopes, leftScopeKey)) {
      // will be merged
      scopes[leftScopeKey] = leftScopes[leftScopeKey]
      return
    }
    const topLevelSpecifier = Object.keys(imports).find(
      (topLevelSpecifierCandidate) => {
        return compareAddressAndSpecifier(
          leftScopeKey,
          topLevelSpecifierCandidate,
        )
      },
    )
    if (topLevelSpecifier) {
      scopes[imports[topLevelSpecifier]] = leftScopes[leftScopeKey]
    } else {
      scopes[leftScopeKey] = leftScopes[leftScopeKey]
    }
  })

  Object.keys(rightScopes).forEach((rightScopeKey) => {
    if (objectHasKey(scopes, rightScopeKey)) {
      scopes[rightScopeKey] = composeTwoMappings(
        scopes[rightScopeKey],
        rightScopes[rightScopeKey],
      )
    } else {
      scopes[rightScopeKey] = {
        ...rightScopes[rightScopeKey],
      }
    }
  })

  return scopes
}
