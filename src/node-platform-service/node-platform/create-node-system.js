/* eslint-disable import/max-dependencies */
import { Module } from "module"
import { pathnameToDirname, hrefToPathname } from "@jsenv/module-resolution"
import { isNativeNodeModuleBareSpecifier } from "@jsenv/module-resolution/src/isNativeNodeModuleBareSpecifier.js"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import "../../system/s.js"
import { hrefToFileRelativePath } from "../../platform/hrefToFileRelativePath.js"
import {
  fromFunctionReturningNamespace,
  fromHref,
} from "../../platform/registerModuleFrom/index.js"
import { valueInstall } from "../../platform/valueInstall.js"
import { hrefToMeta } from "../../platform/hrefToMeta.js"
import { fetchSource } from "./fetchSource.js"
import { evalSource } from "./evalSource.js"

const GLOBAL_SPECIFIER = "global"

export const createNodeSystem = ({
  compileServerOrigin,
  projectPathname,
  compileIntoRelativePath,
  resolveImport,
  executionId,
} = {}) => {
  if (typeof global.System === "undefined") throw new Error(`global.System is undefined`)

  const nodeSystem = new global.System.constructor()

  nodeSystem.resolve = (specifier, importer) => {
    return resolveImport(specifier, importer)
  }

  nodeSystem.instantiate = async (href, importerHref) => {
    if (href === GLOBAL_SPECIFIER) {
      return fromFunctionReturningNamespace(() => global, {
        href,
        importerHref,
      })
    }

    if (isNativeNodeModuleBareSpecifier(href)) {
      return fromFunctionReturningNamespace(
        () => {
          // eslint-disable-next-line import/no-dynamic-require
          const nodeNativeModuleNamespace = require(href)
          return addDefaultToNativeNodeModuleNamespace(nodeNativeModuleNamespace)
        },
        { href, importerHref },
      )
    }

    return fromHref({
      href,
      importerHref,
      fetchSource,
      instantiateJavaScript: (source, realHref) => {
        const uninstallSystemGlobal = valueInstall(global, "System", nodeSystem)
        try {
          evalSource(
            source,
            fileHrefToOperatingSystemPath(realHref, {
              compileServerOrigin,
              projectPathname,
              compileIntoRelativePath,
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
  nodeSystem.createContext = (moduleHref) => {
    const fileHref = moduleHrefToFileHref(moduleHref, {
      compileServerOrigin,
      projectPathname,
      compileIntoRelativePath,
    })

    const filename = pathnameToOperatingSystemPath(hrefToPathname(fileHref))
    const require = createRequireFromFilename(filename)

    return {
      url: fileHref,
      require,
    }
  }

  return nodeSystem
}

const fileHrefToOperatingSystemPath = (
  fileHref,
  { compileServerOrigin, projectPathname, compileIntoRelativePath },
) => {
  if (!compileServerOrigin) {
    if (fileHref.startsWith("file:///"))
      return pathnameToOperatingSystemPath(hrefToPathname(fileHref))
    return fileHref
  }

  const meta = hrefToMeta(fileHref, { compileServerOrigin, compileIntoRelativePath })

  if (meta.type !== "compile-server-compiled-file") {
    return fileHref
  }

  const operatingSystemPath = pathnameToOperatingSystemPath(
    `${projectPathname}${compileIntoRelativePath}/${meta.compileId}${meta.ressource}`,
  )
  return operatingSystemPath
}

const moduleHrefToFileHref = (
  moduleHref,
  { compileServerOrigin, projectPathname, compileIntoRelativePath },
) => {
  if (!compileServerOrigin) return moduleHref

  const fileRelativePath = hrefToFileRelativePath(moduleHref, {
    compileServerOrigin,
    compileIntoRelativePath,
  })
  return `file://${projectPathname}${fileRelativePath}`
}

const addDefaultToNativeNodeModuleNamespace = (namespace) => {
  // const namespaceWithDefault = {}
  // Object.getOwnPropertyNames(namespace).forEach((name) => {
  //   Object.defineProperty(
  //     namespaceWithDefault,
  //     name,
  //     Object.getOwnPropertyDescriptor(namespace, name),
  //   )
  // })
  // namespaceWithDefault.default = namespaceWithDefault
  if (Object.prototype.hasOwnProperty.call(namespace, "default")) return namespace
  namespace.default = namespace
  return namespace
}

// https://nodejs.org/api/modules.html#modules_module_createrequirefrompath_filename
const createRequireFromFilename =
  typeof Module.createRequireFromPath === "function"
    ? Module.createRequireFromPath
    : (filename) => {
        const dirname = pathnameToDirname(filename)
        const moduleObject = new Module(filename)
        moduleObject.filename = filename
        moduleObject.paths = Module._nodeModulePaths(dirname)

        // https://github.com/nodejs/node/blob/f76ce0a75641991bfc235775a4747c978e0e281b/lib/module.js#L506
        const resolve = (specifier) => Module._resolveFilename(specifier, moduleObject)

        const __require = import.meta.require

        // eslint-disable-next-line import/no-dynamic-require
        const scopedRequire = (specifier) => __require(resolve(specifier))

        scopedRequire.main = __require.main
        scopedRequire.extensions = __require.extensions
        scopedRequire.cache = __require.cache
        scopedRequire.resolve = resolve

        return scopedRequire
      }
