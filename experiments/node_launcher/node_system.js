/**

We could use https://nodejs.org/api/esm.html#esm_loaders once it gets stable

*/

import { urlToFileSystemPath, resolveUrl } from "@jsenv/filesystem"
import { isSpecifierForNodeCoreModule } from "@jsenv/importmap/src/isSpecifierForNodeCoreModule.js"

import { createImportResolverForNode } from "@jsenv/core/src/internal/import_resolution/import_resolver_node.js"
import { require } from "@jsenv/core/src/internal/require.js"
import "@jsenv/core/src/internal/runtime_client/s.js"
import {
  fromFunctionReturningNamespace,
  fromFunctionReturningRegisteredModule,
} from "@jsenv/core/src/internal/runtime_client/module_registration.js"

import { getRessourceResponseError } from "../html_supervisor/ressource_response_error.js"
import { createUrlContext } from "../url_context.js"
import { valueInstall } from "./value_install.js"
import { evalSource } from "./eval_source.js"

export const createNodeSystem = async ({
  projectDirectoryUrl,
  compileServerOrigin,
  compileDirectoryRelativeUrl,
  fetchSource,
  importDefaultExtension,
} = {}) => {
  const urlContext = createUrlContext({
    compileServerOrigin,
    compileDirectoryRelativeUrl,
  })

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
          urlContext,
          url,
          importerUrl,
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
    const responseError = await getRessourceResponseError({
      urlContext,
      contentTypeExpected: "application/javascript",
      type: "js_module",
      url,
      importerUrl,
      response,
    })
    if (responseError) {
      throw responseError
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
        urlContext,
        type: "js_module",
        url: response.url,
        importerUrl,
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
