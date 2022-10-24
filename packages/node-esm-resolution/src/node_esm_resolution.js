/*
 * https://nodejs.org/api/esm.html#resolver-algorithm-specification
 * https://github.com/nodejs/node/blob/0367b5c35ea0f98b323175a4aaa8e651af7a91e7/lib/internal/modules/esm/resolve.js#L1
 * deviations from the spec:
 * - take into account "browser", "module" and "jsnext"
 * - the check for isDirectory -> throw is delayed is descoped to the caller
 * - the call to real path ->
 *   delayed to the caller so that we can decide to
 *   maintain symlink as facade url when it's outside project directory
 *   or use the real path when inside
 */
import { pathToFileURL } from "node:url"
import { existsSync, readFileSync, realpathSync } from "node:fs"

import { isSpecifierForNodeBuiltin } from "./node_builtin_specifiers.js"
import { defaultLookupPackageScope } from "./default_lookup_package_scope.js"
import { defaultReadPackageJson } from "./default_read_package_json.js"
import { getParentUrl, isValidUrl } from "./url_utils.js"
import {
  createInvalidModuleSpecifierError,
  createModuleNotFoundError,
  createPackageImportNotDefinedError,
  createPackagePathNotExportedError,
  createInvalidPackageTargetError,
} from "./errors.js"
import { readCustomConditionsFromProcessArgs } from "./custom_conditions.js"

export const applyNodeEsmResolution = ({
  specifier,
  parentUrl,
  conditions = [...readCustomConditionsFromProcessArgs(), "node", "import"],
  lookupPackageScope = defaultLookupPackageScope,
  readPackageJson = defaultReadPackageJson,
  preservesSymlink = false,
}) => {
  const resolution = applyPackageSpecifierResolution(specifier, {
    parentUrl: String(parentUrl),
    conditions,
    lookupPackageScope,
    readPackageJson,
    preservesSymlink,
  })
  const { url } = resolution
  if (url.startsWith("file:")) {
    if (url.includes("%2F") || url.includes("%5C")) {
      throw createInvalidModuleSpecifierError(
        `must not include encoded "/" or "\\" characters`,
        specifier,
        {
          parentUrl,
        },
      )
    }
    return resolution
  }
  return resolution
}

const applyPackageSpecifierResolution = (specifier, resolutionContext) => {
  const { parentUrl } = resolutionContext
  // relative specifier
  if (
    specifier[0] === "/" ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  ) {
    if (specifier[0] !== "/") {
      const browserFieldResolution = applyBrowserFieldResolution(
        specifier,
        resolutionContext,
      )
      if (browserFieldResolution) {
        return browserFieldResolution
      }
    }
    return {
      type: "relative_specifier",
      url: new URL(specifier, parentUrl).href,
    }
  }
  if (specifier[0] === "#") {
    return applyPackageImportsResolution(specifier, resolutionContext)
  }
  try {
    const urlObject = new URL(specifier)
    if (specifier.startsWith("node:")) {
      return {
        type: "node_builtin_specifier",
        url: specifier,
      }
    }
    return {
      type: "absolute_specifier",
      url: urlObject.href,
    }
  } catch (e) {
    // bare specifier
    const browserFieldResolution = applyBrowserFieldResolution(
      specifier,
      resolutionContext,
    )
    if (browserFieldResolution) {
      return browserFieldResolution
    }
    return applyPackageResolve(specifier, resolutionContext)
  }
}

const applyBrowserFieldResolution = (specifier, resolutionContext) => {
  const { parentUrl, conditions, lookupPackageScope, readPackageJson } =
    resolutionContext
  const browserCondition = conditions.includes("browser")
  if (!browserCondition) {
    return null
  }
  const packageDirectoryUrl = lookupPackageScope(parentUrl)
  if (!packageDirectoryUrl) {
    return null
  }
  const packageJson = readPackageJson(packageDirectoryUrl)
  if (!packageJson) {
    return null
  }
  const { browser } = packageJson
  if (!browser) {
    return null
  }
  if (typeof browser !== "object") {
    return null
  }
  let url
  if (specifier.startsWith(".")) {
    const specifierUrl = new URL(specifier, parentUrl).href
    const specifierRelativeUrl = specifierUrl.slice(packageDirectoryUrl.length)
    const secifierRelativeNotation = `./${specifierRelativeUrl}`
    const browserMapping = browser[secifierRelativeNotation]
    if (typeof browserMapping === "string") {
      url = new URL(browserMapping, packageDirectoryUrl).href
    } else if (browserMapping === false) {
      url = `file:///@ignore/${specifierUrl.slice("file:///")}`
    }
  } else {
    const browserMapping = browser[specifier]
    if (typeof browserMapping === "string") {
      url = new URL(browserMapping, packageDirectoryUrl).href
    } else if (browserMapping === false) {
      url = `file:///@ignore/${specifier}`
    }
  }
  if (url) {
    return {
      type: "field:browser",
      packageDirectoryUrl,
      packageJson,
      url,
    }
  }
  return null
}

const applyPackageImportsResolution = (
  internalSpecifier,
  resolutionContext,
) => {
  const { parentUrl, lookupPackageScope, readPackageJson } = resolutionContext
  if (internalSpecifier === "#" || internalSpecifier.startsWith("#/")) {
    throw createInvalidModuleSpecifierError(
      "not a valid internal imports specifier name",
      internalSpecifier,
      resolutionContext,
    )
  }
  const packageDirectoryUrl = lookupPackageScope(parentUrl)
  if (packageDirectoryUrl !== null) {
    const packageJson = readPackageJson(packageDirectoryUrl)
    const { imports } = packageJson
    if (imports !== null && typeof imports === "object") {
      const resolved = applyPackageImportsExportsResolution(internalSpecifier, {
        ...resolutionContext,
        packageDirectoryUrl,
        packageJson,
        isImport: true,
      })
      if (resolved) {
        return resolved
      }
    }
  }
  throw createPackageImportNotDefinedError(internalSpecifier, {
    ...resolutionContext,
    packageDirectoryUrl,
  })
}

const applyPackageResolve = (packageSpecifier, resolutionContext) => {
  const { parentUrl, conditions, readPackageJson, preservesSymlink } =
    resolutionContext
  if (packageSpecifier === "") {
    throw new Error("invalid module specifier")
  }
  if (
    conditions.includes("node") &&
    isSpecifierForNodeBuiltin(packageSpecifier)
  ) {
    return {
      type: "node_builtin_specifier",
      url: `node:${packageSpecifier}`,
    }
  }
  const { packageName, packageSubpath } =
    parsePackageSpecifier(packageSpecifier)
  if (
    packageName[0] === "." ||
    packageName.includes("\\") ||
    packageName.includes("%")
  ) {
    throw createInvalidModuleSpecifierError(
      `is not a valid package name`,
      packageName,
      resolutionContext,
    )
  }
  if (packageSubpath.endsWith("/")) {
    throw new Error("invalid module specifier")
  }
  const selfResolution = applyPackageSelfResolution(packageSubpath, {
    ...resolutionContext,
    packageName,
  })
  if (selfResolution) {
    return selfResolution
  }
  let currentUrl = parentUrl
  while (currentUrl !== "file:///") {
    const packageDirectoryFacadeUrl = new URL(
      `node_modules/${packageName}/`,
      currentUrl,
    ).href
    if (!existsSync(new URL(packageDirectoryFacadeUrl))) {
      currentUrl = getParentUrl(currentUrl)
      continue
    }
    const packageDirectoryUrl = preservesSymlink
      ? packageDirectoryFacadeUrl
      : resolvePackageSymlink(packageDirectoryFacadeUrl)
    const packageJson = readPackageJson(packageDirectoryUrl)
    if (packageJson !== null) {
      const { exports } = packageJson
      if (exports !== null && exports !== undefined) {
        return applyPackageExportsResolution(packageSubpath, {
          ...resolutionContext,
          packageDirectoryUrl,
          packageJson,
          exports,
        })
      }
    }
    return applyLegacySubpathResolution(packageSubpath, {
      ...resolutionContext,
      packageDirectoryUrl,
      packageJson,
    })
  }
  throw createModuleNotFoundError(packageName, resolutionContext)
}

const applyPackageSelfResolution = (packageSubpath, resolutionContext) => {
  const { parentUrl, packageName, lookupPackageScope, readPackageJson } =
    resolutionContext
  const packageDirectoryUrl = lookupPackageScope(parentUrl)
  if (!packageDirectoryUrl) {
    return undefined
  }
  const packageJson = readPackageJson(packageDirectoryUrl)
  if (!packageJson) {
    return undefined
  }
  if (packageJson.name !== packageName) {
    return undefined
  }
  const { exports } = packageJson
  if (!exports) {
    const subpathResolution = applyLegacySubpathResolution(packageSubpath, {
      ...resolutionContext,
      packageDirectoryUrl,
      packageJson,
    })
    if (subpathResolution && subpathResolution.type !== "subpath") {
      return subpathResolution
    }
    return undefined
  }
  return applyPackageExportsResolution(packageSubpath, {
    ...resolutionContext,
    packageDirectoryUrl,
    packageJson,
  })
}

// https://github.com/nodejs/node/blob/0367b5c35ea0f98b323175a4aaa8e651af7a91e7/lib/internal/modules/esm/resolve.js#L642
const applyPackageExportsResolution = (packageSubpath, resolutionContext) => {
  if (packageSubpath === ".") {
    const mainExport = applyMainExportResolution(resolutionContext)
    if (!mainExport) {
      throw createPackagePathNotExportedError(packageSubpath, resolutionContext)
    }
    const resolved = applyPackageTargetResolution(mainExport, {
      ...resolutionContext,
      key: ".",
    })
    if (resolved) {
      return resolved
    }
    throw createPackagePathNotExportedError(packageSubpath, resolutionContext)
  }
  const packageExportsInfo = readExports(resolutionContext)
  if (
    packageExportsInfo.type === "object" &&
    packageExportsInfo.allKeysAreRelative
  ) {
    const resolved = applyPackageImportsExportsResolution(packageSubpath, {
      ...resolutionContext,
      isImport: false,
    })
    if (resolved) {
      return resolved
    }
  }
  throw createPackagePathNotExportedError(packageSubpath, resolutionContext)
}

const applyPackageImportsExportsResolution = (matchKey, resolutionContext) => {
  const { packageJson, isImport } = resolutionContext
  const matchObject = isImport ? packageJson.imports : packageJson.exports

  if (!matchKey.includes("*") && matchObject.hasOwnProperty(matchKey)) {
    const target = matchObject[matchKey]
    return applyPackageTargetResolution(target, {
      ...resolutionContext,
      key: matchKey,
      isImport,
    })
  }
  const expansionKeys = Object.keys(matchObject)
    .filter((key) => key.split("*").length === 2)
    .sort(comparePatternKeys)
  for (const expansionKey of expansionKeys) {
    const [patternBase, patternTrailer] = expansionKey.split("*")
    if (matchKey === patternBase) continue
    if (!matchKey.startsWith(patternBase)) continue
    if (patternTrailer.length > 0) {
      if (!matchKey.endsWith(patternTrailer)) continue
      if (matchKey.length < expansionKey.length) continue
    }
    const target = matchObject[expansionKey]
    const subpath = matchKey.slice(
      patternBase.length,
      matchKey.length - patternTrailer.length,
    )
    return applyPackageTargetResolution(target, {
      ...resolutionContext,
      key: matchKey,
      subpath,
      pattern: true,
      isImport,
    })
  }
  return null
}

const applyPackageTargetResolution = (target, resolutionContext) => {
  const {
    conditions,
    packageDirectoryUrl,
    packageJson,
    key,
    subpath = "",
    pattern = false,
    isImport = false,
  } = resolutionContext

  if (typeof target === "string") {
    if (pattern === false && subpath !== "" && !target.endsWith("/")) {
      throw new Error("invalid module specifier")
    }
    if (target.startsWith("./")) {
      const targetUrl = new URL(target, packageDirectoryUrl).href
      if (!targetUrl.startsWith(packageDirectoryUrl)) {
        throw createInvalidPackageTargetError(
          `target must be inside package`,
          target,
          resolutionContext,
        )
      }
      return {
        type: isImport ? "field:imports" : "field:exports",
        packageDirectoryUrl,
        packageJson,
        url: pattern
          ? targetUrl.replaceAll("*", subpath)
          : new URL(subpath, targetUrl).href,
      }
    }
    if (!isImport || target.startsWith("../") || isValidUrl(target)) {
      throw createInvalidPackageTargetError(
        `target must starst with "./"`,
        target,
        resolutionContext,
      )
    }
    return applyPackageResolve(
      pattern ? target.replaceAll("*", subpath) : `${target}${subpath}`,
      {
        ...resolutionContext,
        parentUrl: packageDirectoryUrl,
      },
    )
  }
  if (Array.isArray(target)) {
    if (target.length === 0) {
      return null
    }
    let lastResult
    let i = 0
    while (i < target.length) {
      const targetValue = target[i]
      i++
      try {
        const resolved = applyPackageTargetResolution(targetValue, {
          ...resolutionContext,
          key: `${key}[${i}]`,
          subpath,
          pattern,
          isImport,
        })
        if (resolved) {
          return resolved
        }
        lastResult = resolved
      } catch (e) {
        if (e.code === "INVALID_PACKAGE_TARGET") {
          continue
        }
        lastResult = e
      }
    }
    if (lastResult) {
      throw lastResult
    }
    return null
  }
  if (target === null) {
    return null
  }
  if (typeof target === "object") {
    const keys = Object.keys(target)
    for (const key of keys) {
      if (Number.isInteger(key)) {
        throw new Error("Invalid package configuration")
      }
      if (key === "default" || conditions.includes(key)) {
        const targetValue = target[key]
        const resolved = applyPackageTargetResolution(targetValue, {
          ...resolutionContext,
          key,
          subpath,
          pattern,
          isImport,
        })
        if (resolved) {
          return resolved
        }
      }
    }
    return null
  }
  throw createInvalidPackageTargetError(
    `target must be a string, array, object or null`,
    target,
    resolutionContext,
  )
}

const readExports = ({ packageDirectoryUrl, packageJson }) => {
  const packageExports = packageJson.exports
  if (Array.isArray(packageExports)) {
    return {
      type: "array",
    }
  }
  if (packageExports === null) {
    return {}
  }
  if (typeof packageExports === "object") {
    const keys = Object.keys(packageExports)
    const relativeKeys = []
    const conditionalKeys = []
    keys.forEach((availableKey) => {
      if (availableKey.startsWith(".")) {
        relativeKeys.push(availableKey)
      } else {
        conditionalKeys.push(availableKey)
      }
    })
    const hasRelativeKey = relativeKeys.length > 0
    if (hasRelativeKey && conditionalKeys.length > 0) {
      throw new Error(
        `Invalid package configuration: cannot mix relative and conditional keys in package.exports
--- unexpected keys ---
${conditionalKeys.map((key) => `"${key}"`).join("\n")}
--- package directory url ---
${packageDirectoryUrl}`,
      )
    }
    return {
      type: "object",
      hasRelativeKey,
      allKeysAreRelative: relativeKeys.length === keys.length,
    }
  }
  if (typeof packageExports === "string") {
    return { type: "string" }
  }
  return {}
}

const parsePackageSpecifier = (packageSpecifier) => {
  if (packageSpecifier[0] === "@") {
    const firstSlashIndex = packageSpecifier.indexOf("/")
    if (firstSlashIndex === -1) {
      throw new Error("invalid module specifier")
    }
    const secondSlashIndex = packageSpecifier.indexOf("/", firstSlashIndex + 1)
    if (secondSlashIndex === -1) {
      return {
        packageName: packageSpecifier,
        packageSubpath: ".",
        isScoped: true,
      }
    }
    const packageName = packageSpecifier.slice(0, secondSlashIndex)
    const afterSecondSlash = packageSpecifier.slice(secondSlashIndex + 1)
    const packageSubpath = `./${afterSecondSlash}`
    return {
      packageName,
      packageSubpath,
      isScoped: true,
    }
  }
  const firstSlashIndex = packageSpecifier.indexOf("/")
  if (firstSlashIndex === -1) {
    return {
      packageName: packageSpecifier,
      packageSubpath: ".",
    }
  }
  const packageName = packageSpecifier.slice(0, firstSlashIndex)
  const afterFirstSlash = packageSpecifier.slice(firstSlashIndex + 1)
  const packageSubpath = `./${afterFirstSlash}`
  return {
    packageName,
    packageSubpath,
  }
}

const applyMainExportResolution = (resolutionContext) => {
  const { packageJson } = resolutionContext
  const packageExportsInfo = readExports(resolutionContext)
  if (
    packageExportsInfo.type === "array" ||
    packageExportsInfo.type === "string"
  ) {
    return packageJson.exports
  }
  if (packageExportsInfo.type === "object") {
    if (packageExportsInfo.hasRelativeKey) {
      return packageJson.exports["."]
    }
    return packageJson.exports
  }
  return undefined
}

const applyLegacySubpathResolution = (packageSubpath, resolutionContext) => {
  const { packageDirectoryUrl, packageJson } = resolutionContext

  if (packageSubpath === ".") {
    return applyLegacyMainResolution(packageSubpath, resolutionContext)
  }
  const browserFieldResolution = applyBrowserFieldResolution(
    packageSubpath,
    resolutionContext,
  )
  if (browserFieldResolution) {
    return browserFieldResolution
  }
  return {
    type: "subpath",
    packageDirectoryUrl,
    packageJson,
    url: new URL(packageSubpath, packageDirectoryUrl).href,
  }
}

const applyLegacyMainResolution = (packageSubpath, resolutionContext) => {
  const { conditions, packageDirectoryUrl, packageJson } = resolutionContext
  for (const condition of conditions) {
    const conditionResolver = mainLegacyResolvers[condition]
    if (!conditionResolver) {
      continue
    }
    const resolved = conditionResolver(resolutionContext)
    if (resolved) {
      return {
        type: resolved.type,
        packageDirectoryUrl,
        packageJson,
        url: new URL(resolved.path, packageDirectoryUrl).href,
      }
    }
  }
  return {
    type: "field:main", // the absence of "main" field
    packageDirectoryUrl,
    packageJson,
    url: new URL("index.js", packageDirectoryUrl).href,
  }
}
const mainLegacyResolvers = {
  import: ({ packageJson }) => {
    if (typeof packageJson.module === "string") {
      return { type: "field:module", path: packageJson.module }
    }
    if (typeof packageJson.jsnext === "string") {
      return { type: "field:jsnext", path: packageJson.jsnext }
    }
    if (typeof packageJson.main === "string") {
      return { type: "field:main", path: packageJson.main }
    }
    return null
  },
  browser: ({ packageDirectoryUrl, packageJson }) => {
    const browserMain = (() => {
      if (typeof packageJson.browser === "string") {
        return packageJson.browser
      }
      if (
        typeof packageJson.browser === "object" &&
        packageJson.browser !== null
      ) {
        return packageJson.browser["."]
      }
      return ""
    })()

    if (!browserMain) {
      if (typeof packageJson.module === "string") {
        return {
          type: "field:module",
          path: packageJson.module,
        }
      }
      return null
    }
    if (
      typeof packageJson.module !== "string" ||
      packageJson.module === browserMain
    ) {
      return {
        type: "field:browser",
        path: browserMain,
      }
    }
    const browserMainUrlObject = new URL(browserMain, packageDirectoryUrl)
    const content = readFileSync(browserMainUrlObject, "utf-8")
    if (
      (/typeof exports\s*==/.test(content) &&
        /typeof module\s*==/.test(content)) ||
      /module\.exports\s*=/.test(content)
    ) {
      return {
        type: "field:module",
        path: packageJson.module,
      }
    }
    return {
      type: "field:browser",
      path: browserMain,
    }
  },
  node: ({ packageJson }) => {
    if (typeof packageJson.main === "string") {
      return {
        type: "field:main",
        path: packageJson.main,
      }
    }
    return null
  },
}

const comparePatternKeys = (keyA, keyB) => {
  if (!keyA.endsWith("/") && !keyA.includes("*")) {
    throw new Error("Invalid package configuration")
  }
  if (!keyB.endsWith("/") && !keyB.includes("*")) {
    throw new Error("Invalid package configuration")
  }
  const aStarIndex = keyA.indexOf("*")
  const baseLengthA = aStarIndex > -1 ? aStarIndex + 1 : keyA.length
  const bStarIndex = keyB.indexOf("*")
  const baseLengthB = bStarIndex > -1 ? bStarIndex + 1 : keyB.length
  if (baseLengthA > baseLengthB) {
    return -1
  }
  if (baseLengthB > baseLengthA) {
    return 1
  }
  if (aStarIndex === -1) {
    return 1
  }
  if (bStarIndex === -1) {
    return -1
  }
  if (keyA.length > keyB.length) {
    return -1
  }
  if (keyB.length > keyA.length) {
    return 1
  }
  return 0
}

const resolvePackageSymlink = (packageDirectoryUrl) => {
  const packageDirectoryPath = realpathSync(new URL(packageDirectoryUrl))
  const packageDirectoryResolvedUrl = pathToFileURL(packageDirectoryPath).href
  return `${packageDirectoryResolvedUrl}/`
}
