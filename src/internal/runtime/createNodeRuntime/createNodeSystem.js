/**

We could use https://nodejs.org/api/esm.html#esm_loaders once it gets stable

*/

import { urlToFileSystemPath, resolveUrl } from "@jsenv/filesystem"
import { isSpecifierForNodeCoreModule } from "@jsenv/importmap/src/isSpecifierForNodeCoreModule.js"

import { createImportResolverForNode } from "@jsenv/core/src/internal/import-resolution/import-resolver-node.js"
import { require } from "../../require.js"
import "../s.js"
import {
  fromFunctionReturningNamespace,
  getJavaScriptModuleResponseError,
  fromFunctionReturningRegisteredModule,
} from "../module-registration.js"
import { valueInstall } from "../valueInstall.js"
import { evalSource } from "./evalSource.js"

export const createNodeSystem = async ({
  projectDirectoryUrl,
  compileServerOrigin,
  compileDirectoryRelativeUrl,
  fetchSource,
  importDefaultExtension,
} = {}) => {
  if (typeof global.System === "undefined") {
    throw new Error(`global.System is undefined`)
  }

  const nodeSystem = new global.System.constructor()
  const nodeImporterResolver = await createImportResolverForNode({
    projectDirectoryUrl,
    compileServerOrigin,
    compileDirectoryRelativeUrl,
    importDefaultExtension,
  })

  const resolve = async (specifier, importer) => {
    return nodeImporterResolver.resolveImport(specifier, importer)
  }

  nodeSystem.resolve = resolve

  nodeSystem.instantiate = async (url, importerUrl) => {
    if (isSpecifierForNodeCoreModule(url)) {
      return fromFunctionReturningNamespace(
        () => {
          const coreNodeModuleSpecifier = url.startsWith("node:")
            ? url.slice("node:".length)
            : url
          // eslint-disable-next-line import/no-dynamic-require
          const moduleExportsForNativeNodeModule = require(coreNodeModuleSpecifier)
          return moduleExportsToModuleNamespace(
            moduleExportsForNativeNodeModule,
          )
        },
        {
          url,
          importerUrl,
          compileServerOrigin,
          compileDirectoryRelativeUrl,
        },
      )
    }

    let response
    try {
      response = await fetchSource(url, {
        importerUrl,
      })
    } catch (e) {
      e.code = "NETWORK_FAILURE"
      throw e
    }

    const responseError = await getJavaScriptModuleResponseError(response, {
      url,
      importerUrl,
      compileServerOrigin,
      compileDirectoryRelativeUrl,
      jsonContentTypeAccepted: process.execArgv.includes(
        "--experimental-json-modules",
      ),
    })
    if (responseError) {
      throw responseError
    }

    const contentType = response.headers["content-type"]
    if (contentType === "application/json" || contentType.endsWith("+json")) {
      const responseBodyAsJson = await response.json()
      return fromFunctionReturningNamespace(
        () => {
          return {
            default: responseBodyAsJson,
          }
        },
        {
          url: response.url,
          importerUrl,
          compileServerOrigin,
          compileDirectoryRelativeUrl,
        },
      )
    }

    const responseBodyAsText = await response.text()
    return fromFunctionReturningRegisteredModule(
      () => {
        const uninstallSystemGlobal = valueInstall(global, "System", nodeSystem)
        try {
          evalSource(
            responseBodyAsText,
            responseUrlToSourceUrl(response.url, {
              projectDirectoryUrl,
              compileServerOrigin,
            }),
          )
        } finally {
          uninstallSystemGlobal()
        }

        return nodeSystem.getRegister()
      },
      {
        url: response.url,
        importerUrl,
        compileServerOrigin,
        compileDirectoryRelativeUrl,
      },
    )
  }

  // https://github.com/systemjs/systemjs/blob/master/docs/hooks.md#createcontexturl---object
  nodeSystem.createContext = (url) => {
    const projectUrl = nodeImporterResolver.asProjectUrl(url, {
      projectDirectoryUrl,
      compileDirectoryRelativeUrl,
      compileServerOrigin,
    })

    return {
      url: projectUrl || url,
      resolve: async (specifier) => {
        const urlResolved = await resolve(specifier, url)
        return nodeImporterResolver.fileUrlFromUrl(urlResolved, {
          projectDirectoryUrl,
          compileDirectoryRelativeUrl,
          compileServerOrigin,
        })
      },
    }
  }

  return nodeSystem
}

const responseUrlToSourceUrl = (
  responseUrl,
  { compileServerOrigin, projectDirectoryUrl },
) => {
  if (responseUrl.startsWith("file://")) {
    return urlToFileSystemPath(responseUrl)
  }
  // compileServerOrigin is optionnal
  // because we can also create a node system and use it to import a build
  // from filesystem. In that case there is no compileServerOrigin
  if (
    compileServerOrigin &&
    responseUrl.startsWith(`${compileServerOrigin}/`)
  ) {
    const afterOrigin = responseUrl.slice(`${compileServerOrigin}/`.length)
    const fileUrl = resolveUrl(afterOrigin, projectDirectoryUrl)
    return urlToFileSystemPath(fileUrl)
  }
  return responseUrl
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
