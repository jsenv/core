// https://github.com/benmosher/eslint-plugin-import/blob/master/resolvers/node/index.js
// https://github.com/benmosher/eslint-plugin-import/tree/master/resolvers
// https://github.com/olalonde/eslint-import-resolver-babel-root-import

import { createRequire } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"
import {
  assertAndNormalizeDirectoryUrl,
  ensureWindowsDriveLetter,
  getRealFileSystemUrlSync,
} from "@jsenv/filesystem"

import { isSpecifierForNodeBuiltin } from "@jsenv/node-esm-resolution/src/node_builtin_specifiers.js"
import {
  determineModuleSystem,
  applyNodeEsmResolution,
  applyFileSystemMagicResolution,
  readCustomConditionsFromProcessArgs,
  getExtensionsToTry,
} from "@jsenv/node-esm-resolution"
import { createLogger } from "./logger.js"
import { applyImportmapResolution } from "./importmap_resolution.js"
import { applyUrlResolution } from "./url_resolution.js"

export const interfaceVersion = 2

export const resolve = (
  source,
  file,
  {
    logLevel,
    rootDirectoryUrl,
    packageConditions = ["browser", "import"],
    ambiguousExtensions = [".js", ".html", ".jsx", ".ts", ".tsx"],
    importmapFileRelativeUrl,
    caseSensitive = true,
    // NICE TO HAVE: allow more control on when magic resolution applies:
    // one might want to enable this for node_modules but not for project files
    magicDirectoryIndex,
    magicExtensions,
  },
) => {
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(
    rootDirectoryUrl,
    "rootDirectoryUrl",
  )
  const logger = createLogger({ logLevel })
  logger.debug(`
resolve import.
--- specifier ---
${source}
--- importer ---
${file}
--- root directory path ---
${fileURLToPath(rootDirectoryUrl)}`)

  const triggerNotFoundWarning = ({ resolver, specifier, importer, url }) => {
    const logLevel =
      importer.includes(".xtest.js") || specifier.includes("/not_found.js")
        ? "debug"
        : "warn"
    if (resolver === "esm") {
      logger[logLevel](
        `esm module resolution failed for "${specifier}" imported by ${importer}`,
      )
    } else if (resolver === "commonjs") {
      logger[logLevel](
        `commonjs module resolution failed for "${specifier}" imported by ${importer}`,
      )
    } else {
      logger[logLevel](
        `filesystem resolution failed for "${specifier}" imported by ${importer} (file not found at ${url})`,
      )
    }
  }

  packageConditions = [
    ...readCustomConditionsFromProcessArgs(),
    ...packageConditions,
  ]
  const browserInPackageConditions = packageConditions.includes("browser")
  const nodeInPackageConditions = packageConditions.includes("node")
  if (nodeInPackageConditions && isSpecifierForNodeBuiltin(source)) {
    logger.debug(`-> native node module`)
    return {
      found: true,
      path: null,
    }
  }

  const importer = String(pathToFileURL(file))
  const onUrl = (url) => {
    if (url.startsWith("file:")) {
      url = ensureWindowsDriveLetter(url, importer)
      if (magicDirectoryIndex === undefined) {
        if (url.includes("/node_modules/")) {
          magicDirectoryIndex = true
        } else {
          magicDirectoryIndex = false
        }
      }
      if (magicExtensions === undefined) {
        if (url.includes("/node_modules/")) {
          magicExtensions = ["inherit", ".js"]
        } else {
          magicExtensions = false
        }
      }

      return handleFileUrl(url, {
        specifier,
        importer,
        logger,
        caseSensitive,
        magicDirectoryIndex,
        magicExtensions,
        triggerNotFoundWarning,
      })
    }
    if (url.startsWith("node:") && !nodeInPackageConditions) {
      logger.warn(
        `Warning: ${file} is using "node:" scheme but "node" is not in packageConditions (importing "${source}")`,
      )
    }
    logger.debug(`-> consider found because of scheme ${url}`)
    return handleRemainingUrl()
  }

  const specifier = source
  try {
    if (
      browserInPackageConditions &&
      !nodeInPackageConditions &&
      specifier[0] === "/"
    ) {
      return onUrl(new URL(specifier.slice(1), rootDirectoryUrl).href, {
        resolvedBy: "url",
      })
    }

    // data:*, http://*, https://*, file://*
    if (isAbsoluteUrl(specifier)) {
      return onUrl(specifier, {
        resolvedBy: "url",
      })
    }
    if (importmapFileRelativeUrl) {
      const urlFromImportmap = applyImportmapResolution(specifier, {
        logger,
        rootDirectoryUrl,
        importmapFileRelativeUrl,
        importer,
      })
      if (urlFromImportmap) {
        return onUrl(urlFromImportmap, {
          resolvedBy: "importmap",
        })
      }
    }
    const moduleSystem = determineModuleSystem(importer, {
      ambiguousExtensions,
    })
    if (moduleSystem === "commonjs") {
      const requireForImporter = createRequire(importer)
      let url
      try {
        url = requireForImporter.resolve(specifier)
      } catch (e) {
        if (e.code === "MODULE_NOT_FOUND") {
          triggerNotFoundWarning({
            resolver: "commonjs",
            specifier,
            importer,
          })
          return { found: false, path: specifier }
        }
        throw e
      }
      return onUrl(url, {
        resolvedBy: "commonjs",
      })
    }
    if (moduleSystem === "module") {
      let nodeResolution
      try {
        nodeResolution = applyNodeEsmResolution({
          conditions: packageConditions,
          parentUrl: importer,
          specifier,
        })
      } catch (e) {
        if (e.code === "MODULE_NOT_FOUND") {
          triggerNotFoundWarning({
            resolver: "esm",
            specifier,
            importer,
          })
          return { found: false, path: specifier }
        }
        throw e
      }
      if (nodeResolution) {
        return onUrl(nodeResolution.url, {
          resolvedBy: "node_esm",
        })
      }
    }
    if (moduleSystem === "url") {
      return onUrl(applyUrlResolution(specifier, importer), {
        resolvedBy: "url",
      })
    }
    throw new Error("not found")
  } catch (e) {
    logger.error(`Error while resolving "${source}" imported from "${file}"
--- error stack ---
${e.stack}`)
    return {
      found: false,
      path: null,
    }
  }
}

const handleFileUrl = (
  fileUrl,
  {
    specifier,
    importer,
    logger,
    magicDirectoryIndex,
    magicExtensions,
    caseSensitive,
    triggerNotFoundWarning,
  },
) => {
  fileUrl = `file://${new URL(fileUrl).pathname}` // remove query params from url
  const fileResolution = applyFileSystemMagicResolution(fileUrl, {
    magicDirectoryIndex,
    magicExtensions: getExtensionsToTry(magicExtensions, importer),
  })
  if (!fileResolution.found) {
    triggerNotFoundWarning({
      resolver: "filesystem",
      specifier,
      importer,
      url: fileUrl,
    })
    return { found: false, path: fileURLToPath(fileUrl) }
  }
  fileUrl = fileResolution.url
  const realFileUrl = getRealFileSystemUrlSync(fileUrl, {
    // we don't follow link because we care only about the theoric file location
    // without this realFileUrl and fileUrl can be different
    // and we would log the warning about case sensitivity
    followLink: false,
  })
  const filePath = fileURLToPath(fileUrl)
  const realFilePath = realFileUrl ? fileURLToPath(realFileUrl) : filePath
  if (caseSensitive && realFileUrl && realFileUrl !== fileUrl) {
    logger.warn(
      `WARNING: file found for ${filePath} but would not be found on a case sensitive filesystem.
The real file path is ${realFilePath}.
You can choose to disable this warning by disabling case sensitivity.
If you do so keep in mind windows users would not find that file.`,
    )
    return {
      found: false,
      path: realFilePath,
    }
  }
  logger.debug(`-> found file at ${realFilePath}`)
  return {
    found: true,
    path: realFilePath,
  }
}

const handleRemainingUrl = () => {
  return {
    found: true,
    path: null,
  }
}

const isAbsoluteUrl = (url) => {
  try {
    // eslint-disable-next-line no-new
    new URL(url)
    return true
  } catch (e) {
    return false
  }
}
