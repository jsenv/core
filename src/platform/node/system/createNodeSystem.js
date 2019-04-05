import { Module } from "module"
import "/node_modules/systemjs/dist/system.js"
import {
  resolveImport,
  remapResolvedImport,
  pathnameToDirname,
  hrefToPathname,
} from "/node_modules/@jsenv/module-resolution/index.js"
import { isNativeNodeModuleBareSpecifier } from "/node_modules/@jsenv/module-resolution/src/isNativeNodeModuleBareSpecifier.js"
import { hrefToFilenameRelative } from "../../hrefToFilenameRelative.js"
import {
  fromFunctionReturningNamespace,
  fromHref,
  computeFileAndImporterFile,
} from "../../registerModuleFrom/registerModuleFrom.js"
import { fetchSource } from "../fetchSource.js"
import { moduleSourceToSystemRegisteredModule } from "../moduleSourceToSystemRegisteredModule.js"

export const createNodeSystem = ({
  importMap,
  compileInto,
  sourceOrigin,
  compileServerOrigin,
  compileId,
}) => {
  const nodeSystem = new global.System.constructor()

  nodeSystem.resolve = (specifier, importer) => {
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

  nodeSystem.instantiate = async (href, importer) => {
    if (isNativeNodeModuleBareSpecifier(href)) {
      return fromFunctionReturningNamespace(
        () => {
          // eslint-disable-next-line import/no-dynamic-require
          const nodeNativeModuleExports = require(href)
          return {
            ...nodeNativeModuleExports,
            default: nodeNativeModuleExports,
          }
        },
        computeFileAndImporterFile({
          href,
          importer,
          compileInto,
          sourceOrigin,
          compileServerOrigin,
          compileId,
        }),
      )
    }

    return fromHref({
      compileInto,
      sourceOrigin,
      compileServerOrigin,
      compileId,
      fetchSource,
      platformSystem: nodeSystem,
      moduleSourceToSystemRegisteredModule,
      href,
      importer,
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
