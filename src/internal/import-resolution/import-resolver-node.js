import { createRequire } from "module"
import { urlToExtension, resolveUrl, urlToRelativeUrl, readFile } from "@jsenv/filesystem"
import { isSpecifierForNodeCoreModule } from "@jsenv/import-map/src/isSpecifierForNodeCoreModule.js"

import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

import { applyDefaultExtension } from "./default-extension.js"

export const createImportResolverForNode = async ({
  projectDirectoryUrl,
  compileServerOrigin,
  compileDirectoryRelativeUrl,
  importDefaultExtension,
}) => {
  if (typeof import.meta.resolve === "undefined") {
    throw new Error(
      `import.meta.resolve is undefined, code must be executed with --experimental-import-meta-resolve`,
    )
  }

  const defaultModuleResolution = await determineModuleSystem(projectDirectoryUrl)

  const resolveImport = async (specifier, importer) => {
    if (isSpecifierForNodeCoreModule(specifier)) {
      return specifier
    }

    if (importDefaultExtension) {
      specifier = applyDefaultExtension(specifier, importer)
    }

    if (specifier.startsWith("http:") || specifier.startsWith("https:")) {
      return specifier
    }

    // handle self reference inside jsenv itself, it is not allowed by Node.js
    // for some reason
    if (specifier.startsWith("@jsenv/core/")) {
      if (projectDirectoryUrl === jsenvCoreDirectoryUrl) {
        specifier = resolveUrl(specifier.slice("@jsenv/core/".length), projectDirectoryUrl)
      }
    }

    const moduleResolutionAlgorithm = importer
      ? moduleResolutionFromImporter(importer) || defaultModuleResolution
      : defaultModuleResolution

    importer = importer || resolveUrl(compileDirectoryRelativeUrl, compileServerOrigin)

    if (moduleResolutionAlgorithm === "esm") {
      return resolveUsingNodeEsModuleAlgorithm(specifier, {
        projectDirectoryUrl,
        compileServerOrigin,
        compileDirectoryRelativeUrl,
        importer,
      })
    }

    return resolveUsingNodeCommonJsAlgorithm(specifier, {
      projectDirectoryUrl,
      compileServerOrigin,
      compileDirectoryRelativeUrl,
      importer,
    })
  }

  return { resolveImport, fileUrlFromUrl }
}

// https://nodejs.org/dist/latest-v16.x/docs/api/packages.html#packages_determining_module_system)
const determineModuleSystem = async (projectDirectoryUrl) => {
  const inputTypeIsModule = process.execArgv.some((argv) => argv === "--input-type=module")
  if (inputTypeIsModule) {
    return "esm"
  }

  return moduleResolutionFromProjectPackage(projectDirectoryUrl)
}

const moduleResolutionFromProjectPackage = async (projectDirectoryUrl) => {
  const packageJsonFileUrl = new URL("package.json", projectDirectoryUrl)
  let packageJson
  try {
    packageJson = await readFile(packageJsonFileUrl, {
      as: "json",
    })
  } catch (e) {
    if (e && e.code === "ENOENT") {
      return "esm"
    }
  }
  if (packageJson.type === "module") {
    return "esm"
  }
  return "commonjs"
}

const moduleResolutionFromImporter = (importer) => {
  if (urlToExtension(importer) === ".cjs") {
    return "commonjs"
  }

  if (urlToExtension(importer) === ".mjs") {
    return "esm"
  }

  // we should read the nearest package.json and search for type
  return undefined
}

const resolveUsingNodeEsModuleAlgorithm = async (
  specifier,
  { projectDirectoryUrl, compileServerOrigin, compileDirectoryRelativeUrl, importer },
) => {
  const importerFileUrl = fileUrlFromUrl(importer, {
    projectDirectoryUrl,
    compileServerOrigin,
    compileDirectoryRelativeUrl,
  })

  const importResolution = await import.meta.resolve(specifier, importerFileUrl)
  return transformResolvedUrl(importResolution, {
    importer,
    projectDirectoryUrl,
    compileServerOrigin,
    compileDirectoryRelativeUrl,
  })
}

const resolveUsingNodeCommonJsAlgorithm = (
  specifier,
  { projectDirectoryUrl, compileServerOrigin, compileDirectoryRelativeUrl, importer },
) => {
  const importerFileUrl = fileUrlFromUrl(importer, {
    projectDirectoryUrl,
    compileDirectoryRelativeUrl,
    compileServerOrigin,
  })
  const require = createRequire(importerFileUrl)
  const requireResolution = require.resolve(specifier)
  return transformResolvedUrl(requireResolution, {
    importer,
    projectDirectoryUrl,
    compileDirectoryRelativeUrl,
    compileServerOrigin,
  })
}

const transformResolvedUrl = (
  url,
  { importer, projectDirectoryUrl, compileServerOrigin, compileDirectoryRelativeUrl },
) => {
  const compileServerUrl = compileServerUrlFromOriginalUrl(url, {
    importer,
    projectDirectoryUrl,
    compileDirectoryRelativeUrl,
    compileServerOrigin,
  })
  return compileServerUrl
}

const fileUrlFromUrl = (
  url,
  { projectDirectoryUrl, compileDirectoryRelativeUrl, compileServerOrigin },
) => {
  if (!url.startsWith(`${compileServerOrigin}/`)) {
    return url
  }

  if (url === compileServerOrigin) {
    return url
  }

  const afterOrigin = url.slice(`${compileServerOrigin}/`.length)
  if (!afterOrigin.startsWith(compileDirectoryRelativeUrl)) {
    return url
  }

  const afterCompileDirectory = afterOrigin.slice(compileDirectoryRelativeUrl.length)
  return resolveUrl(afterCompileDirectory, projectDirectoryUrl)
}

const compileServerUrlFromOriginalUrl = (
  url,
  { importer, projectDirectoryUrl, compileDirectoryRelativeUrl, compileServerOrigin },
) => {
  if (!url.startsWith(projectDirectoryUrl)) {
    return url
  }

  // si l'importer était compilé, compile aussi le fichier
  const compileDirectoryServerUrl = resolveUrl(compileDirectoryRelativeUrl, compileServerOrigin)
  if (importer.startsWith(compileDirectoryServerUrl)) {
    const projectRelativeUrl = urlToRelativeUrl(url, projectDirectoryUrl)
    return resolveUrl(projectRelativeUrl, compileDirectoryServerUrl)
  }

  const projectRelativeUrl = urlToRelativeUrl(url, projectDirectoryUrl)
  return resolveUrl(projectRelativeUrl, compileDirectoryServerUrl)
}
