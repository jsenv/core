import "systemjs/dist/system.js"
import {
  resolveImport,
  remapResolvedImport,
  isNativeNodeModuleBareSpecifier,
} from "@jsenv/module-resolution"
import { fromFunctionReturningNamespace, fromHref } from "../../registerModuleFrom.js"
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

    return remapResolvedImport({
      importMap,
      importerHref: importer,
      resolvedImport,
    })
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
        { href, importer },
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
  // nodeSystem.createContext = (url) => {
  //   return { url }
  // }

  return nodeSystem
}
