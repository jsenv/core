/* eslint-disable import/max-dependencies */
import { Module } from "module"
import {
  resolveImport,
  remapResolvedImport,
  pathnameToDirname,
  hrefToPathname,
} from "/node_modules/@jsenv/module-resolution/index.js"
import { isNativeNodeModuleBareSpecifier } from "/node_modules/@jsenv/module-resolution/src/isNativeNodeModuleBareSpecifier.js"
import { hrefToFilenameRelative } from "../../hrefToFilenameRelative.js"
import { fromFunctionReturningNamespace, fromHref } from "../../registerModuleFrom/index.js"
import { valueInstall } from "../../valueInstall.js"
import { compiledHrefToCompiledFilename } from "../compiledHrefToCompiledFilename.js"
import { fetchSource } from "../fetchSource.js"
import { evalSource } from "../evalSource.js"
// const SYSTEMJS_RELATIVE_PATH = "src/systemjs/s.js"
import "../../../../src/systemjs/s.js"

const GLOBAL_SPECIFIER = "global"

export const createNodeSystem = async ({
  importMap,
  compileInto,
  sourceOrigin,
  compileServerOrigin,
}) => {
  // await import(`/${SYSTEMJS_RELATIVE_PATH}`)

  const nodeSystem = new global.System.constructor()

  nodeSystem.resolve = (specifier, importer) => {
    if (specifier === GLOBAL_SPECIFIER) return specifier

    if (isNativeNodeModuleBareSpecifier(specifier)) return specifier

    const resolvedImport = resolveImport({
      importer,
      specifier,
    })

    const remappedImport = remapResolvedImport({
      importMap,
      importerHref: importer,
      resolvedImport,
    })

    return remappedImport
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
        const belongToProject = realHref.startsWith(`${compileServerOrigin}/`)
        const sourceHref = belongToProject
          ? compiledHrefToCompiledFilename(realHref, {
              compileInto,
              sourceOrigin,
              compileServerOrigin,
            })
          : realHref

        const uninstallSystemGlobal = valueInstall(global, "System", nodeSystem)
        try {
          evalSource(source, sourceHref)
        } finally {
          uninstallSystemGlobal()
        }

        return nodeSystem.getRegister()
      },
    })
  }

  // https://github.com/systemjs/systemjs/blob/master/docs/hooks.md#createcontexturl---object
  nodeSystem.createContext = (moduleUrl) => {
    const filenameRelative = hrefToFilenameRelative(moduleUrl, { compileInto, compileServerOrigin })
    const fileURL = `${sourceOrigin}/${filenameRelative}`
    const url = fileURL

    const filename = hrefToPathname(fileURL)
    const require = createRequireFromFilename(filename)

    return {
      url,
      require,
    }
  }

  return nodeSystem
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

        // eslint-disable-next-line import/no-dynamic-require
        const scopedRequire = (specifier) => require(resolve(specifier))

        scopedRequire.main = require.main
        scopedRequire.extensions = require.extensions
        scopedRequire.cache = require.cache
        scopedRequire.resolve = resolve

        return scopedRequire
      }
