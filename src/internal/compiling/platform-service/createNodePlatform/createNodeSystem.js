/* eslint-disable import/max-dependencies */
import "../s.js"
import { fileUrlToPath, resolveFileUrl } from "../../../urlUtils.js"
import { fromFunctionReturningNamespace, fromUrl } from "../module-registration.js"
import { valueInstall } from "../valueInstall.js"
import { createRequireFromPath } from "./createRequireFromPath.js"
import { isNativeNodeModuleBareSpecifier } from "./isNativeNodeModuleBareSpecifier.js"
import { fetchSource } from "./fetchSource.js"
import { evalSource } from "./evalSource.js"

const GLOBAL_SPECIFIER = "global"

export const createNodeSystem = ({
  compileServerOrigin,
  projectDirectoryUrl,
  compileDirectoryRelativePath,
  resolveImport,
  executionId,
} = {}) => {
  if (typeof global.System === "undefined") throw new Error(`global.System is undefined`)

  const nodeSystem = new global.System.constructor()

  nodeSystem.resolve = (specifier, importer) => {
    return resolveImport(specifier, importer)
  }

  nodeSystem.instantiate = async (url, importerUrl) => {
    if (url === GLOBAL_SPECIFIER) {
      return fromFunctionReturningNamespace(() => global, {
        url,
        importerUrl,
      })
    }

    if (isNativeNodeModuleBareSpecifier(url)) {
      return fromFunctionReturningNamespace(
        () => {
          // eslint-disable-next-line import/no-dynamic-require
          const moduleExportsForNativeNodeModule = require(url)
          return moduleExportsToModuleNamespace(moduleExportsForNativeNodeModule)
        },
        { url, importerUrl },
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
              compileServerOrigin,
              projectDirectoryUrl,
              compileDirectoryRelativePath,
            }),
          )
        } finally {
          uninstallSystemGlobal()
        }

        return nodeSystem.getRegister()
      },
      executionId,
    })
  }

  // https://github.com/systemjs/systemjs/blob/master/docs/hooks.md#createcontexturl---object
  nodeSystem.createContext = (url) => {
    const resolve = (specifier) => {
      const urlResolved = resolveImport(specifier, url)
      return urlToOriginalUrl(urlResolved, {
        compileServerOrigin,
        projectDirectoryUrl,
        compileDirectoryRelativePath,
      })
    }

    const originalUrl = urlToOriginalUrl(url, {
      compileServerOrigin,
      projectDirectoryUrl,
      compileDirectoryRelativePath,
    })

    const require = createRequireFromPath(
      originalUrl.startsWith("file://")
        ? fileUrlToPath(originalUrl)
        : fileUrlToPath(projectDirectoryUrl),
    )
    return {
      url: originalUrl,
      resolve,
      require,
    }
  }

  return nodeSystem
}

const responseUrlToSourceUrl = (responseUrl, { compileServerOrigin, projectDirectoryUrl }) => {
  if (responseUrl.startsWith("file://")) {
    return fileUrlToPath(responseUrl)
  }
  // compileServerOrigin is optionnal
  // because we can also create a node system and use it to import a bundle
  // from filesystem. In that case there is no compileServerOrigin
  if (compileServerOrigin && responseUrl.startsWith(`${compileServerOrigin}/`)) {
    const afterOrigin = responseUrl.slice(`${compileServerOrigin}/`.length)
    const fileUrl = resolveFileUrl(afterOrigin, projectDirectoryUrl)
    return fileUrlToPath(fileUrl)
  }
  return responseUrl
}

const urlToOriginalUrl = (
  url,
  { compileServerOrigin, projectDirectoryUrl, compileDirectoryRelativePath },
) => {
  if (!url.startsWith(`${compileServerOrigin}/`)) {
    return url
  }

  if (url === compileServerOrigin) {
    return url
  }

  const afterOrigin = url.slice(`${compileServerOrigin}/`.length)
  if (!afterOrigin.startsWith(compileDirectoryRelativePath)) {
    return url
  }

  const afterCompileDirectory = afterOrigin.slice(compileDirectoryRelativePath.length)
  const nextSlashIndex = afterCompileDirectory.indexOf("/")
  if (nextSlashIndex === -1) {
    return url
  }

  const afterCompileId = afterCompileDirectory.slice(nextSlashIndex + 1)
  return resolveFileUrl(afterCompileId, projectDirectoryUrl)
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
