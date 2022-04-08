// https://github.com/benmosher/eslint-plugin-import/blob/master/resolvers/node/index.js
// https://github.com/benmosher/eslint-plugin-import/tree/master/resolvers
// https://github.com/olalonde/eslint-import-resolver-babel-root-import

import { createRequire } from "node:module"
import {
  assertAndNormalizeDirectoryUrl,
  ensureWindowsDriveLetter,
  urlToFileSystemPath,
  fileSystemPathToUrl,
  getRealFileSystemUrlSync,
} from "@jsenv/filesystem"

import { createLogger } from "./logger.js"
import { isSpecifierForNodeBuiltin } from "../../node-esm-resolution/src/node_builtin_specifiers.js"
import {
  determineModuleSystem,
  applyNodeEsmResolution,
  applyFileSystemMagicResolution,
} from "../../node-esm-resolution/main.js"

import { applyImportmapResolution } from "./importmap_resolution.js"
import { applyUrlResolution } from "./url_resolution.js"

export const interfaceVersion = 2

export const resolve = (
  source,
  file,
  {
    logLevel,
    projectDirectoryUrl,
    packageConditions = ["browser", "import"],
    importmapFileRelativeUrl,
    caseSensitive = true,
    // NICE TO HAVE: allow more control on when magic resolution applies:
    // one might want to enable this for node_modules but not for project files
    magicDirectoryIndex = false,
    magicExtensions = false,
  },
) => {
  projectDirectoryUrl = assertAndNormalizeDirectoryUrl(projectDirectoryUrl)
  const logger = createLogger({ logLevel })
  logger.debug(`
resolve import for project.
--- specifier ---
${source}
--- importer ---
${file}
--- project directory path ---
${urlToFileSystemPath(projectDirectoryUrl)}`)
  const nodeInPackageConditions = packageConditions.includes("node")
  if (nodeInPackageConditions && isSpecifierForNodeBuiltin(source)) {
    logger.debug(`-> native node module`)
    return {
      found: true,
      path: null,
    }
  }

  const importer = String(fileSystemPathToUrl(file))
  const onUrl = (url) => {
    if (url.startsWith("file:")) {
      url = ensureWindowsDriveLetter(url, importer)
      return handleFileUrl(url, {
        logger,
        projectDirectoryUrl,
        caseSensitive,
        magicDirectoryIndex,
        magicExtensions,
      })
    }
    if (url.startsWith("node:") && !nodeInPackageConditions) {
      logger.warn(
        `Warning: ${file} is using "node:" scheme but "node" is not in packageConditions (importing "${source}")`,
      )
    }
    logger.debug(`-> consider found because of scheme ${url}`)
    return handleRemainingUrl(url)
  }

  const specifier = source
  try {
    // data:*, http://*, https://*, file://*
    if (isAbsoluteUrl(specifier)) {
      return onUrl(specifier)
    }
    if (importmapFileRelativeUrl) {
      const urlFromImportmap = applyImportmapResolution(specifier, {
        logger,
        projectDirectoryUrl,
        importmapFileRelativeUrl,
        importer,
      })
      if (urlFromImportmap) {
        return onUrl(urlFromImportmap)
      }
    }
    const moduleSystem = determineModuleSystem(importer, {
      ambiguousExtensions: [".js", ".html"],
    })
    if (moduleSystem === "commonjs") {
      return onUrl(createRequire(importer).resolve(specifier))
    }
    if (moduleSystem === "json") {
      return onUrl(applyUrlResolution(specifier, importer))
    }
    if (moduleSystem === "module") {
      const nodeResolution = applyNodeEsmResolution({
        conditions: packageConditions,
        parentUrl: importer,
        specifier,
      })
      if (nodeResolution) {
        return onUrl(nodeResolution.url)
      }
    }
    throw new Error("not found")
  } catch (e) {
    logger.debug(`Error while resolving "${source}" imported from "${file}"
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
  { logger, magicDirectoryIndex, magicExtensions, caseSensitive },
) => {
  fileUrl = `file://${new URL(fileUrl).pathname}` // remove query params from url
  const fileResolution = applyFileSystemMagicResolution(fileUrl, {
    magicDirectoryIndex,
    magicExtensions,
  })
  if (!fileResolution.found) {
    logger.debug(`-> file not found at ${fileUrl}`)
    return {
      found: false,
      path: urlToFileSystemPath(fileUrl),
    }
  }
  fileUrl = fileResolution.url
  const realFileUrl = getRealFileSystemUrlSync(fileUrl, {
    // we don't follow link because we care only about the theoric file location
    // without this realFileUrl and fileUrl can be different
    // and we would log the warning about case sensitivity
    followLink: false,
  })
  const filePath = urlToFileSystemPath(fileUrl)
  const realFilePath = urlToFileSystemPath(realFileUrl)
  if (caseSensitive && realFileUrl !== fileUrl) {
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
