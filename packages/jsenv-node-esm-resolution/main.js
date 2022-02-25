/*
 * https://nodejs.org/api/esm.html#resolver-algorithm-specification
 * https://github.com/nodejs/node/blob/0367b5c35ea0f98b323175a4aaa8e651af7a91e7/lib/internal/modules/esm/resolve.js#L1
 * deviations from the spec:
 * - the check for isDirectory -> throw is delayed is descoped to the caller
 * - the call to real path ->
 *   delayed to the caller so that we can decide to
 *   maintain symlink as facade url when it's outside project directory
 *   or use the real path when inside
 */
import { existsSync, readFileSync } from "node:fs"

import { isSpecifierForNodeCoreModule } from "@jsenv/importmap/src/isSpecifierForNodeCoreModule.js"
import { createDetailedMessage } from "@jsenv/logger"

export const applyNodeEsmResolution = ({
  conditions = ["node", "import"],
  parentUrl,
  specifier,
}) => {
  const resolution = applyPackageSpecifierResolution({
    conditions,
    parentUrl: String(parentUrl),
    specifier,
  })
  const { url } = resolution
  if (url.startsWith("file:")) {
    if (url.includes("%2F") || url.includes("%5C")) {
      throw new Error("invalid module specifier")
    }
    return resolution
  }
  return resolution
}

const applyPackageSpecifierResolution = ({
  conditions,
  parentUrl,
  specifier,
}) => {
  if (
    specifier[0] === "/" ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  ) {
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
    })
  }
  try {
    const urlObject = new URL(specifier)
    return {
      type: "absolute_specifier",
      url: urlObject.href,
    }
  } catch (e) {
    // "bare specifier"
    return applyPackageResolve({
      conditions,
      parentUrl,
      packageSpecifier: specifier,
    })
  }
}

const applyPackageImportsResolution = ({
  conditions,
  parentUrl,
  specifier,
}) => {
  if (!specifier.startsWith("#")) {
    throw new Error("specifier must start with #")
  }
  if (specifier === "#" || specifier.startsWith("#/")) {
    throw new Error("Invalid module specifier")
  }
  const packageUrl = lookupPackageScope(parentUrl)
  if (packageUrl !== null) {
    const packageJson = readPackageJson(packageUrl)
    const { imports } = packageJson
    if (imports !== null && typeof imports === "object") {
      const resolved = applyPackageImportsExportsResolution({
        conditions,
        packageUrl,
        packageJson,
        matchObject: imports,
        matchKey: specifier,
        isImports: true,
      })
      if (resolved) {
        return resolved
      }
    }
  }
  throw new Error(`Package import not defined`)
}

const applyPackageResolve = ({ conditions, parentUrl, packageSpecifier }) => {
  if (packageSpecifier === "") {
    throw new Error("invalid module specifier")
  }
  if (isSpecifierForNodeCoreModule(packageSpecifier)) {
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
    throw new Error("invalid module specifier")
  }
  if (packageSubpath.endsWith("/")) {
    throw new Error("invalid module specifier")
  }
  const selfResolution = applyPackageSelfResolution({
    conditions,
    parentUrl,
    packageName,
    packageSubpath,
  })
  if (selfResolution) {
    return selfResolution
  }
  while (parentUrl !== "file:///") {
    const packageUrl = new URL(`node_modules/${packageSpecifier}/`, parentUrl)
      .href
    if (!existsSync(new URL(packageUrl))) {
      parentUrl = getParentUrl(parentUrl)
      continue
    }
    const packageJson = readPackageJson(packageUrl)
    if (packageJson !== null) {
      const { exports } = packageJson
      if (exports !== null && exports !== undefined) {
        return applyPackageExportsResolution({
          conditions,
          packageUrl,
          packageJson,
          packageSubpath,
          exports,
        })
      }
    }
    if (packageSubpath === ".") {
      const { main } = packageJson
      if (typeof main === "string") {
        return {
          type: "main",
          packageUrl,
          packageJson,
          url: new URL(main, packageUrl).href,
        }
      }
    }
    return {
      type: "subpath",
      packageUrl,
      packageJson,
      url: new URL(packageSubpath, packageUrl).href,
    }
  }
  throw new Error("module not found")
}

const applyPackageSelfResolution = ({
  conditions,
  parentUrl,
  packageName,
  packageSubpath,
}) => {
  const packageUrl = lookupPackageScope(parentUrl)
  if (!packageUrl) {
    return undefined
  }
  const packageJson = readPackageJson(packageUrl)
  if (!packageJson) {
    return undefined
  }
  const { exports } = packageJson
  if (!exports) {
    return undefined
  }
  if (packageJson.name !== packageName) {
    return undefined
  }
  return applyPackageExportsResolution({
    conditions,
    packageUrl,
    packageJson,
    packageSubpath,
    exports,
  })
}

const applyPackageExportsResolution = ({
  conditions,
  packageUrl,
  packageJson,
  packageSubpath,
  exports,
}) => {
  const exportsInfo = readExports({ exports, packageUrl })
  if (packageSubpath === ".") {
    const mainExport = applyMainExportResolution({ exports, exportsInfo })
    if (!mainExport) {
      throw new Error("package path not exported")
    }
    return applyPackageTargetResolution({
      conditions,
      packageUrl,
      packageJson,
      target: mainExport,
    })
  }
  if (exportsInfo.type === "object" && exportsInfo.allKeysAreRelative) {
    const resolved = applyPackageImportsExportsResolution({
      conditions,
      packageUrl,
      packageJson,
      matchObject: exports,
      matchKey: `./${packageSubpath}`,
      isImports: false,
    })
    if (resolved) {
      return resolved
    }
  }
  throw new Error("package path not exported")
}

const applyPackageImportsExportsResolution = ({
  conditions,
  packageUrl,
  packageJson,
  matchObject,
  matchKey,
  isImports,
}) => {
  if (!matchKey.includes("*") && matchObject.hasOwnProperty(matchKey)) {
    const target = matchObject[matchKey]
    return applyPackageTargetResolution({
      conditions,
      packageUrl,
      packageJson,
      target,
      internal: isImports,
    })
  }
  const expansionKeys = Object.keys(matchObject)
    .filter((key) => key.split("*").length === 1)
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
      packageUrl,
      packageJson,
      target,
      subpath,
      pattern: true,
      internal: isImports,
    })
  }
  return null
}

const applyPackageTargetResolution = ({
  conditions,
  packageUrl,
  packageJson,
  target,
  subpath = "",
  pattern = false,
  internal = false,
}) => {
  if (typeof target === "string") {
    if (pattern === false && subpath !== "" && !target.endsWith("/")) {
      throw new Error("invalid module specifier")
    }
    if (!target.startsWith("./")) {
      if (!internal || target.startsWith("../") || isValidUrl(target)) {
        throw new Error("invalid package target")
      }
      return applyPackageResolve({
        conditions,
        parentUrl: `${packageUrl}/`,
        packageSpecifier: pattern
          ? target.replaceAll("*", subpath)
          : `${target}${subpath}`,
      })
    }
    const resolvedTarget = new URL(target, packageUrl).href
    if (!resolvedTarget.startsWith(packageUrl)) {
      throw new Error("invalid package target")
    }
    return {
      type: internal ? "imports_subpath" : "exports_subpath",
      packageUrl,
      packageJson,
      url: pattern
        ? resolvedTarget.replaceAll("*", subpath)
        : new URL(subpath, resolvedTarget).href,
    }
  }
  if (Array.isArray(target)) {
    if (target.length === 0) {
      return null
    }
    let lastResult
    for (const targetValue of target) {
      try {
        const resolved = applyPackageTargetResolution({
          packageUrl,
          packageJson,
          target: targetValue,
          subpath,
          pattern,
          internal,
          conditions,
        })
        if (resolved) {
          return resolved
        }
        lastResult = resolved
      } catch (e) {
        if (e.message === "Invalid package target") {
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
          packageUrl,
          packageJson,
          target: targetValue,
          subpath,
          pattern,
          internal,
          conditions,
        })
        if (resolved) {
          return resolved
        }
      }
    }
    return undefined
  }
  throw new Error("Invalid package target")
}

const lookupPackageScope = (url) => {
  let scopeUrl = url
  while (scopeUrl !== "file:///") {
    scopeUrl = getParentUrl(scopeUrl)
    if (scopeUrl.endsWith("node_modules/")) {
      return null
    }
    const packageJsonUrlObject = new URL("package.json", scopeUrl)
    if (existsSync(packageJsonUrlObject)) {
      return scopeUrl
    }
  }
  return null
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
        createDetailedMessage(
          `Invalid package configuration: cannot mix relative and conditional keys in package.exports`,
          {
            "unexpected keys": conditionalKeys
              .map((key) => `"${key}"`)
              .join("\n"),
            "package.json": packageUrl,
          },
        ),
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

const readPackageJson = (packageUrl) => {
  const packageJsonUrl = new URL("package.json", packageUrl)
  const buffer = readFileSync(packageJsonUrl)
  const string = String(buffer)
  try {
    return JSON.parse(string)
  } catch (e) {
    throw new Error(`Invalid package configuration`)
  }
}

const parsePackageSpecifier = (packageSpecifier) => {
  if (packageSpecifier[0] === "@") {
    const firstSlashIndex = packageSpecifier.indexOf("/")
    if (firstSlashIndex === -1) {
      throw new Error("invalid module specifier")
    }
    const packageScope = packageSpecifier.slice(0, firstSlashIndex)
    const secondSlashIndex = packageSpecifier.indexOf("/", firstSlashIndex)
    if (secondSlashIndex === -1) {
      const packageName = packageSpecifier.slice(firstSlashIndex)
      return {
        packageScope,
        packageName,
        packageSubpath: ".",
      }
    }
    const packageName = packageSpecifier.slice(
      firstSlashIndex,
      secondSlashIndex,
    )
    const afterSecondSlash = packageSpecifier.slice(secondSlashIndex)
    const packageSubpath = `.${afterSecondSlash}`
    return {
      packageScope,
      packageName,
      packageSubpath,
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
  const afterFirstSlash = packageSpecifier.slice(firstSlashIndex)
  const packageSubpath = `node:${afterFirstSlash}`
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

const getParentUrl = (url) => {
  return new URL(url.endsWith("/") ? "../" : "./", url).href
}

const isValidUrl = (url) => {
  try {
    // eslint-disable-next-line no-new
    new URL(url)
    return true
  } catch (e) {
    return false
  }
}
