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
import { existsSync, readFileSync } from "node:fs"

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

export const applyNodeEsmResolution = ({
  conditions = ["node", "import"],
  parentUrl,
  specifier,
  lookupPackageScope = defaultLookupPackageScope,
  readPackageJson = defaultReadPackageJson,
}) => {
  const resolution = applyPackageSpecifierResolution({
    conditions,
    parentUrl: String(parentUrl),
    specifier,
    lookupPackageScope,
    readPackageJson,
  })
  const { url } = resolution
  if (url.startsWith("file:")) {
    if (url.includes("%2F") || url.includes("%5C")) {
      throw createInvalidModuleSpecifierError({
        specifier,
        parentUrl,
        reason: `must not include encoded "/" or "\\" characters`,
      })
    }
    return resolution
  }
  return resolution
}

const applyPackageSpecifierResolution = ({
  conditions,
  parentUrl,
  specifier,
  lookupPackageScope,
  readPackageJson,
}) => {
  // relative specifier
  if (
    specifier[0] === "/" ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  ) {
    if (specifier[0] !== "/") {
      const browserFieldResolution = applyBrowserFieldResolution({
        conditions,
        parentUrl,
        specifier,
        lookupPackageScope,
        readPackageJson,
      })
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
    return applyPackageImportsResolution({
      conditions,
      parentUrl,
      specifier,
      lookupPackageScope,
      readPackageJson,
    })
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
    const browserFieldResolution = applyBrowserFieldResolution({
      conditions,
      parentUrl,
      packageSpecifier: specifier,
      lookupPackageScope,
      readPackageJson,
    })
    if (browserFieldResolution) {
      return browserFieldResolution
    }
    return applyPackageResolve({
      conditions,
      parentUrl,
      packageSpecifier: specifier,
      lookupPackageScope,
      readPackageJson,
    })
  }
}

const applyBrowserFieldResolution = ({
  conditions,
  parentUrl,
  packageSpecifier,
  lookupPackageScope,
  readPackageJson,
}) => {
  const browserCondition = conditions.includes("browser")
  if (!browserCondition) {
    return null
  }
  const packageUrl = lookupPackageScope(parentUrl)
  if (!packageUrl) {
    return null
  }
  const packageJson = readPackageJson(packageUrl)
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
  if (packageSpecifier.startsWith(".")) {
    const packageSpecifierUrl = new URL(packageSpecifier, parentUrl).href
    const packageSpecifierRelativeUrl = packageSpecifierUrl.slice(
      packageUrl.length,
    )
    const packageSpecifierRelativeNotation = `./${packageSpecifierRelativeUrl}`
    const browserMapping = browser[packageSpecifierRelativeNotation]
    if (typeof browserMapping === "string") {
      url = new URL(browserMapping, packageUrl).href
    } else if (browserMapping === false) {
      url = `file:///@ignore/${packageSpecifierUrl.slice("file:///")}`
    }
  } else {
    const browserMapping = browser[packageSpecifier]
    if (typeof browserMapping === "string") {
      url = new URL(browserMapping, packageUrl).href
    } else if (browserMapping === false) {
      url = `file:///@ignore/${packageSpecifier}`
    }
  }
  if (url) {
    return {
      type: "browser",
      packageUrl,
      packageJson,
      url,
    }
  }
  return null
}

const applyPackageImportsResolution = ({
  conditions,
  parentUrl,
  specifier,
  lookupPackageScope,
  readPackageJson,
}) => {
  if (!specifier.startsWith("#")) {
    throw createInvalidModuleSpecifierError({
      specifier,
      parentUrl,
      reason: "internal imports must start with #",
    })
  }
  if (specifier === "#" || specifier.startsWith("#/")) {
    throw createInvalidModuleSpecifierError({
      specifier,
      parentUrl,
      reason: "not a valid internal imports specifier name",
    })
  }
  const packageUrl = lookupPackageScope(parentUrl)
  if (packageUrl !== null) {
    const packageJson = readPackageJson(packageUrl)
    const { imports } = packageJson
    if (imports !== null && typeof imports === "object") {
      const resolved = applyPackageImportsExportsResolution({
        conditions,
        parentUrl,
        packageUrl,
        packageJson,
        matchObject: imports,
        matchKey: specifier,
        isImports: true,
        lookupPackageScope,
        readPackageJson,
      })
      if (resolved) {
        return resolved
      }
    }
  }
  throw createPackageImportNotDefinedError({
    specifier,
    packageUrl,
    parentUrl,
  })
}

const applyPackageResolve = ({
  conditions,
  parentUrl,
  packageSpecifier,
  lookupPackageScope,
  readPackageJson,
}) => {
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
    throw createInvalidModuleSpecifierError({
      specifier: packageName,
      parentUrl,
      reason: `is not a valid package name`,
    })
  }
  if (packageSubpath.endsWith("/")) {
    throw new Error("invalid module specifier")
  }
  const selfResolution = applyPackageSelfResolution({
    conditions,
    parentUrl,
    packageName,
    packageSubpath,
    lookupPackageScope,
    readPackageJson,
  })
  if (selfResolution) {
    return selfResolution
  }
  let currentUrl = parentUrl
  while (currentUrl !== "file:///") {
    const packageUrl = new URL(`node_modules/${packageName}/`, currentUrl).href
    if (!existsSync(new URL(packageUrl))) {
      currentUrl = getParentUrl(currentUrl)
      continue
    }
    const packageJson = readPackageJson(packageUrl)
    if (packageJson !== null) {
      const { exports } = packageJson
      if (exports !== null && exports !== undefined) {
        return applyPackageExportsResolution({
          conditions,
          parentUrl,
          packageUrl,
          packageJson,
          packageSubpath,
          exports,
          lookupPackageScope,
          readPackageJson,
        })
      }
    }
    return applyLegacySubpathResolution({
      conditions,
      parentUrl,
      packageUrl,
      packageJson,
      packageSubpath,
      lookupPackageScope,
      readPackageJson,
    })
  }
  throw createModuleNotFoundError({
    specifier: packageName,
    parentUrl,
  })
}

const applyPackageSelfResolution = ({
  conditions,
  parentUrl,
  packageName,
  packageSubpath,
  lookupPackageScope,
  readPackageJson,
}) => {
  const packageUrl = lookupPackageScope(parentUrl)
  if (!packageUrl) {
    return undefined
  }
  const packageJson = readPackageJson(packageUrl)
  if (!packageJson) {
    return undefined
  }
  if (packageJson.name !== packageName) {
    return undefined
  }
  const { exports } = packageJson
  if (!exports) {
    const subpathResolution = applyLegacySubpathResolution({
      conditions,
      parentUrl,
      packageUrl,
      packageJson,
      packageSubpath,
      lookupPackageScope,
      readPackageJson,
    })
    if (subpathResolution && subpathResolution.type !== "subpath") {
      return subpathResolution
    }
    return undefined
  }
  return applyPackageExportsResolution({
    conditions,
    parentUrl,
    packageUrl,
    packageJson,
    packageSubpath,
    exports,
    lookupPackageScope,
    readPackageJson,
  })
}

// https://github.com/nodejs/node/blob/0367b5c35ea0f98b323175a4aaa8e651af7a91e7/lib/internal/modules/esm/resolve.js#L642
const applyPackageExportsResolution = ({
  conditions,
  parentUrl,
  packageUrl,
  packageJson,
  packageSubpath,
  exports,
  lookupPackageScope,
  readPackageJson,
}) => {
  const exportsInfo = readExports({ exports, packageUrl })
  if (packageSubpath === ".") {
    const mainExport = applyMainExportResolution({ exports, exportsInfo })
    if (!mainExport) {
      throw createPackagePathNotExportedError({
        subpath: packageSubpath,
        parentUrl,
        packageUrl,
      })
    }
    const resolved = applyPackageTargetResolution({
      conditions,
      parentUrl,
      packageUrl,
      packageJson,
      key: ".",
      target: mainExport,
      lookupPackageScope,
      readPackageJson,
    })
    if (resolved) {
      return resolved
    }
    throw createPackagePathNotExportedError({
      subpath: packageSubpath,
      parentUrl,
      packageUrl,
    })
  }
  if (exportsInfo.type === "object" && exportsInfo.allKeysAreRelative) {
    const resolved = applyPackageImportsExportsResolution({
      conditions,
      parentUrl,
      packageUrl,
      packageJson,
      matchObject: exports,
      matchKey: packageSubpath,
      isImports: false,
      lookupPackageScope,
      readPackageJson,
    })
    if (resolved) {
      return resolved
    }
  }
  throw createPackagePathNotExportedError({
    subpath: packageSubpath,
    parentUrl,
    packageUrl,
  })
}

const applyPackageImportsExportsResolution = ({
  conditions,
  parentUrl,
  packageUrl,
  packageJson,
  matchObject,
  matchKey,
  isImports,
  lookupPackageScope,
  readPackageJson,
}) => {
  if (!matchKey.includes("*") && matchObject.hasOwnProperty(matchKey)) {
    const target = matchObject[matchKey]
    return applyPackageTargetResolution({
      conditions,
      parentUrl,
      packageUrl,
      packageJson,
      key: matchKey,
      target,
      internal: isImports,
      lookupPackageScope,
      readPackageJson,
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
    return applyPackageTargetResolution({
      conditions,
      parentUrl,
      packageUrl,
      packageJson,
      key: matchKey,
      target,
      subpath,
      pattern: true,
      internal: isImports,
      lookupPackageScope,
      readPackageJson,
    })
  }
  return null
}

const applyPackageTargetResolution = ({
  conditions,
  parentUrl,
  packageUrl,
  packageJson,
  key,
  target,
  subpath = "",
  pattern = false,
  internal = false,
  lookupPackageScope,
  readPackageJson,
}) => {
  if (typeof target === "string") {
    if (pattern === false && subpath !== "" && !target.endsWith("/")) {
      throw new Error("invalid module specifier")
    }
    if (target.startsWith("./")) {
      const targetUrl = new URL(target, packageUrl).href
      if (!targetUrl.startsWith(packageUrl)) {
        throw createInvalidPackageTargetError({
          parentUrl,
          packageUrl,
          target,
          key,
          isImport: internal,
          reason: `target must be inside package`,
        })
      }
      return {
        type: internal ? "imports_subpath" : "exports_subpath",
        packageUrl,
        packageJson,
        url: pattern
          ? targetUrl.replaceAll("*", subpath)
          : new URL(subpath, targetUrl).href,
      }
    }
    if (!internal || target.startsWith("../") || isValidUrl(target)) {
      throw createInvalidPackageTargetError({
        parentUrl,
        packageUrl,
        target,
        key,
        isImport: internal,
        reason: `target must starst with "./"`,
      })
    }
    return applyPackageResolve({
      conditions,
      parentUrl: packageUrl,
      packageSpecifier: pattern
        ? target.replaceAll("*", subpath)
        : `${target}${subpath}`,
      lookupPackageScope,
      readPackageJson,
    })
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
        const resolved = applyPackageTargetResolution({
          conditions,
          parentUrl,
          packageUrl,
          packageJson,
          key: `${key}[${i}]`,
          target: targetValue,
          subpath,
          pattern,
          internal,
          lookupPackageScope,
          readPackageJson,
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
        const resolved = applyPackageTargetResolution({
          conditions,
          parentUrl,
          packageUrl,
          packageJson,
          key,
          target: targetValue,
          subpath,
          pattern,
          internal,
          lookupPackageScope,
          readPackageJson,
        })
        if (resolved) {
          return resolved
        }
      }
    }
    return null
  }
  throw createInvalidPackageTargetError({
    parentUrl,
    packageUrl,
    target,
    key,
    isImport: internal,
    reason: `target must be a string, array, object or null`,
  })
}

const readExports = ({ exports, packageUrl }) => {
  if (Array.isArray(exports)) {
    return {
      type: "array",
    }
  }
  if (exports === null) {
    return {}
  }
  if (typeof exports === "object") {
    const keys = Object.keys(exports)
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
--- package.json ---
${packageUrl}`,
      )
    }
    return {
      type: "object",
      hasRelativeKey,
      allKeysAreRelative: relativeKeys.length === keys.length,
    }
  }
  if (typeof exports === "string") {
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

const applyMainExportResolution = ({ exports, exportsInfo }) => {
  if (exportsInfo.type === "array" || exportsInfo.type === "string") {
    return exports
  }
  if (exportsInfo.type === "object") {
    if (exportsInfo.hasRelativeKey) {
      return exports["."]
    }
    return exports
  }
  return undefined
}

const applyLegacySubpathResolution = ({
  conditions,
  parentUrl,
  packageUrl,
  packageJson,
  packageSubpath,
  lookupPackageScope,
  readPackageJson,
}) => {
  if (packageSubpath === ".") {
    return applyLegacyMainResolution({
      conditions,
      packageUrl,
      packageJson,
    })
  }
  const browserFieldResolution = applyBrowserFieldResolution({
    conditions,
    parentUrl,
    specifier: packageSubpath,
    lookupPackageScope,
    readPackageJson,
  })
  if (browserFieldResolution) {
    return browserFieldResolution
  }
  return {
    type: "subpath",
    packageUrl,
    packageJson,
    url: new URL(packageSubpath, packageUrl).href,
  }
}

const applyLegacyMainResolution = ({ conditions, packageUrl, packageJson }) => {
  for (const condition of conditions) {
    const resolved = mainLegacyResolvers[condition](packageJson, packageUrl)
    if (resolved) {
      return {
        type: resolved.type,
        packageUrl,
        packageJson,
        url: new URL(resolved.path, packageUrl).href,
      }
    }
  }
  return {
    type: "default",
    packageUrl,
    packageJson,
    url: new URL("index.js", packageUrl).href,
  }
}
const mainLegacyResolvers = {
  import: (packageJson) => {
    if (typeof packageJson.module === "string") {
      return { type: "module", path: packageJson.module }
    }
    if (typeof packageJson.jsnext === "string") {
      return { type: "jsnext", path: packageJson.jsnext }
    }
    if (typeof packageJson.main === "string") {
      return { type: "main", path: packageJson.main }
    }
    return null
  },
  browser: (packageJson, packageUrl) => {
    const browserMain =
      typeof packageJson.browser === "string"
        ? packageJson.browser
        : typeof packageJson.browser === "object" &&
          packageJson.browser !== null
        ? packageJson.browser["."]
        : ""
    if (!browserMain) {
      if (typeof packageJson.module === "string") {
        return {
          type: "module",
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
        type: "browser",
        path: browserMain,
      }
    }
    const browserMainUrlObject = new URL(browserMain, packageUrl)
    const content = readFileSync(browserMainUrlObject, "utf-8")
    if (
      (/typeof exports\s*==/.test(content) &&
        /typeof module\s*==/.test(content)) ||
      /module\.exports\s*=/.test(content)
    ) {
      return {
        type: "module",
        path: packageJson.module,
      }
    }
    return {
      type: "browser",
      path: browserMain,
    }
  },
  node: (packageJson) => {
    if (typeof packageJson.main === "string") {
      return {
        type: "main",
        path: packageJson.main,
      }
    }
    return null
  },
}

const comparePatternKeys = (keyA, keyB) => {
  if (!keyA.endsWith("/") && !keyA.contains("*")) {
    throw new Error("Invalid package configuration")
  }
  if (!keyB.endsWith("/") && !keyB.contains("*")) {
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
