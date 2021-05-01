/**

We could use https://nodejs.org/api/esm.html#esm_loaders once it gets stable

*/

import { urlToFileSystemPath, resolveUrl, urlToExtension, urlToRelativeUrl } from "@jsenv/util"
import { createRequire } from "module"
import { isSpecifierForNodeCoreModule } from "@jsenv/import-map/src/isSpecifierForNodeCoreModule.js"
import { require } from "../../require.js"
import { jsenvCoreDirectoryUrl } from "../../jsenvCoreDirectoryUrl.js"
import "../s.js"
import { fromFunctionReturningNamespace, fromUrl } from "../module-registration.js"
import { valueInstall } from "../valueInstall.js"
import { evalSource } from "./evalSource.js"

const GLOBAL_SPECIFIER = "global"

export const createNodeSystem = ({
  projectDirectoryUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,
  fetchSource,
  defaultNodeModuleResolution = "esm",
} = {}) => {
  if (typeof global.System === "undefined") {
    throw new Error(`global.System is undefined`)
  }

  const nodeSystem = new global.System.constructor()

  const resolve = async (specifier, importer) => {
    if (specifier === GLOBAL_SPECIFIER) {
      return specifier
    }

    if (isSpecifierForNodeCoreModule(specifier)) {
      return specifier
    }

    if (specifier.startsWith("http:") || specifier.startsWith("https:")) {
      return specifier
    }

    let importerFileUrl
    if (importer === undefined) {
      importer = resolveUrl(outDirectoryRelativeUrl, compileServerOrigin)
      importerFileUrl = resolveUrl(outDirectoryRelativeUrl, projectDirectoryUrl)
    } else {
      importerFileUrl = fileUrlFromUrl(importer, {
        projectDirectoryUrl,
        compileServerOrigin,
        outDirectoryRelativeUrl,
      })
    }

    const moduleResolution =
      decideNodeModuleResolution(importerFileUrl) || defaultNodeModuleResolution

    // handle self reference inside jsenv itself, it is not allowed by Node.js
    // for some reason
    if (projectDirectoryUrl === jsenvCoreDirectoryUrl && specifier.startsWith("@jsenv/core/")) {
      specifier = resolveUrl(specifier.slice("@jsenv/core/".length), projectDirectoryUrl)
    }

    if (urlToExtension(importer) === ".ts" || urlToExtension(importer) === ".tsx") {
      const fakeUrl = resolveUrl(specifier, importer)
      // typescript extension magic
      if (urlToExtension(fakeUrl) === "") {
        specifier = `${specifier}.ts`
      }
    }

    if (moduleResolution === "commonjs") {
      const require = createRequire(importerFileUrl)
      const requireResolution = require.resolve(specifier)
      return transformResolvedUrl(requireResolution, {
        importer,
        projectDirectoryUrl,
        outDirectoryRelativeUrl,
        compileServerOrigin,
      })
    }

    const importResolution = await import.meta.resolve(specifier, importerFileUrl)
    return transformResolvedUrl(importResolution, {
      importer,
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      compileServerOrigin,
    })
  }

  nodeSystem.resolve = resolve

  nodeSystem.instantiate = async (url, importerUrl) => {
    if (url === GLOBAL_SPECIFIER) {
      return fromFunctionReturningNamespace(() => global, {
        url,
        importerUrl,
        compileServerOrigin,
        outDirectoryRelativeUrl,
      })
    }

    if (isSpecifierForNodeCoreModule(url)) {
      return fromFunctionReturningNamespace(
        () => {
          // eslint-disable-next-line import/no-dynamic-require
          const moduleExportsForNativeNodeModule = require(url)
          return moduleExportsToModuleNamespace(moduleExportsForNativeNodeModule)
        },
        {
          url,
          importerUrl,
          compileServerOrigin,
          outDirectoryRelativeUrl,
        },
      )
    }

    return fromUrl({
      url,
      importerUrl,
      fetchSource,
      instantiateJavaScript: (responseBody, responseUrl) => {
        const uninstallSystemGlobal = valueInstall(global, "System", nodeSystem)
        try {
          evalSource(
            responseBody,
            responseUrlToSourceUrl(responseUrl, {
              projectDirectoryUrl,
              compileServerOrigin,
            }),
          )
        } finally {
          uninstallSystemGlobal()
        }

        return nodeSystem.getRegister()
      },
      outDirectoryRelativeUrl,
      compileServerOrigin,
    })
  }

  // https://github.com/systemjs/systemjs/blob/master/docs/hooks.md#createcontexturl---object
  nodeSystem.createContext = (url) => {
    const fileUrl = fileUrlFromUrl(url, {
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      compileServerOrigin,
    })

    return {
      url: fileUrl,
      resolve: async (specifier) => {
        const urlResolved = await resolve(specifier, url)
        return fileUrlFromUrl(urlResolved, {
          projectDirectoryUrl,
          outDirectoryRelativeUrl,
          compileServerOrigin,
        })
      },
    }
  }

  return nodeSystem
}

const transformResolvedUrl = (
  url,
  { importer, projectDirectoryUrl, outDirectoryRelativeUrl, compileServerOrigin },
) => {
  const compileServerUrl = compileServerUrlFromOriginalUrl(url, {
    importer,
    projectDirectoryUrl,
    outDirectoryRelativeUrl,
    compileServerOrigin,
  })
  return compileServerUrl
}

const decideNodeModuleResolution = (importer) => {
  if (!importer) {
    return undefined
  }

  if (urlToExtension(importer) === ".cjs") {
    return "commonjs"
  }

  if (urlToExtension(importer) === ".mjs") {
    return "esm"
  }

  return undefined
}

const responseUrlToSourceUrl = (responseUrl, { compileServerOrigin, projectDirectoryUrl }) => {
  if (responseUrl.startsWith("file://")) {
    return urlToFileSystemPath(responseUrl)
  }
  // compileServerOrigin is optionnal
  // because we can also create a node system and use it to import a build
  // from filesystem. In that case there is no compileServerOrigin
  if (compileServerOrigin && responseUrl.startsWith(`${compileServerOrigin}/`)) {
    const afterOrigin = responseUrl.slice(`${compileServerOrigin}/`.length)
    const fileUrl = resolveUrl(afterOrigin, projectDirectoryUrl)
    return urlToFileSystemPath(fileUrl)
  }
  return responseUrl
}

const fileUrlFromUrl = (
  url,
  { projectDirectoryUrl, outDirectoryRelativeUrl, compileServerOrigin },
) => {
  if (!url.startsWith(`${compileServerOrigin}/`)) {
    return url
  }

  if (url === compileServerOrigin) {
    return url
  }

  const afterOrigin = url.slice(`${compileServerOrigin}/`.length)
  if (!afterOrigin.startsWith(outDirectoryRelativeUrl)) {
    return url
  }

  const afterCompileDirectory = afterOrigin.slice(outDirectoryRelativeUrl.length)
  const nextSlashIndex = afterCompileDirectory.indexOf("/")
  if (nextSlashIndex === -1) {
    return url
  }

  const afterCompileId = afterCompileDirectory.slice(nextSlashIndex + 1)
  return resolveUrl(afterCompileId, projectDirectoryUrl)
}

const compileServerUrlFromOriginalUrl = (
  url,
  { importer, projectDirectoryUrl, outDirectoryRelativeUrl, compileServerOrigin },
) => {
  if (!url.startsWith(projectDirectoryUrl)) {
    return url
  }

  // si l'importer était compilé, compile aussi le fichier
  const outDirectoryServerUrl = resolveUrl(outDirectoryRelativeUrl, compileServerOrigin)
  if (importer.startsWith(outDirectoryServerUrl)) {
    const afterOutDirectory = importer.slice(outDirectoryServerUrl.length)
    const parts = afterOutDirectory.split("/")
    const importerCompileId = parts[0]
    const importerCompileDirectory = resolveUrl(`${importerCompileId}/`, outDirectoryServerUrl)
    const projectRelativeUrl = urlToRelativeUrl(url, projectDirectoryUrl)
    return resolveUrl(projectRelativeUrl, importerCompileDirectory)
  }

  const projectRelativeUrl = urlToRelativeUrl(url, projectDirectoryUrl)
  return resolveUrl(projectRelativeUrl, outDirectoryServerUrl)
}

const moduleExportsToModuleNamespace = (moduleExports) => {
  // keep in mind moduleExports can be a function (like require('stream'))
  if (typeof moduleExports === "object" && "default" in moduleExports) {
    return moduleExports
  }

  return {
    ...moduleExports,
    default: moduleExports,
  }
}
