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
  compileDirectoryRelativeUrl,
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

    const moduleResolution = importer
      ? decideNodeModuleResolution(importer) || defaultNodeModuleResolution
      : defaultNodeModuleResolution

    // handle self reference inside jsenv itself, it is not allowed by Node.js
    // for some reason
    if (projectDirectoryUrl === jsenvCoreDirectoryUrl && specifier.startsWith("@jsenv/core/")) {
      specifier = resolveUrl(specifier.slice("@jsenv/core/".length), projectDirectoryUrl)
    }

    if (importer && (urlToExtension(importer) === ".ts" || urlToExtension(importer) === ".tsx")) {
      const fakeUrl = resolveUrl(specifier, importer)
      // typescript extension magic
      if (urlToExtension(fakeUrl) === "") {
        specifier = `${specifier}.ts`
      }
    }

    if (moduleResolution === "commonjs") {
      return resolveUsingNodeCommonJsAlgorithm(specifier, {
        projectDirectoryUrl,
        compileServerOrigin,
        compileDirectoryRelativeUrl,
        importer,
      })
    }

    return resolveUsingNodeEsModuleAlgorithm(specifier, {
      importer,
      projectDirectoryUrl,
      compileServerOrigin,
      compileDirectoryRelativeUrl,
    })
  }

  nodeSystem.resolve = resolve

  nodeSystem.instantiate = async (url, importerUrl) => {
    if (url === GLOBAL_SPECIFIER) {
      return fromFunctionReturningNamespace(() => global, {
        url,
        importerUrl,
        compileServerOrigin,
        compileDirectoryRelativeUrl,
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
          compileDirectoryRelativeUrl,
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
      compileDirectoryRelativeUrl,
      compileServerOrigin,
    })
  }

  // https://github.com/systemjs/systemjs/blob/master/docs/hooks.md#createcontexturl---object
  nodeSystem.createContext = (url) => {
    const fileUrl = fileUrlFromUrl(url, {
      projectDirectoryUrl,
      compileDirectoryRelativeUrl,
      compileServerOrigin,
    })

    return {
      url: fileUrl,
      resolve: async (specifier) => {
        const urlResolved = await resolve(specifier, url)
        return fileUrlFromUrl(urlResolved, {
          projectDirectoryUrl,
          compileDirectoryRelativeUrl,
          compileServerOrigin,
        })
      },
    }
  }

  return nodeSystem
}

const resolveUsingNodeEsModuleAlgorithm = async (
  specifier,
  {
    projectDirectoryUrl,
    compileServerOrigin,
    compileDirectoryRelativeUrl,
    importer = resolveUrl(compileDirectoryRelativeUrl, compileServerOrigin),
  },
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
  {
    projectDirectoryUrl,
    compileServerOrigin,
    compileDirectoryRelativeUrl,
    importer = resolveUrl(compileDirectoryRelativeUrl, compileServerOrigin),
  },
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
