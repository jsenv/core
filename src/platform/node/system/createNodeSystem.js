import "systemjs/dist/system.js"
import { isCoreNodeModuleSpecifier, resolveRootRelativeSpecifier } from "@jsenv/module-resolution"
import { overrideSystemResolve } from "../../overrideSystemResolve.js"
import { overrideSystemInstantiate } from "../../overrideSystemInstantiate.js"
import { fromFunctionReturningNamespace } from "../../registerModuleFrom.js"
import { fetchSource } from "../fetchSource.js"
import { moduleSourceToSystemRegisteredModule } from "../moduleSourceToSystemRegisteredModule.js"

export const createNodeSystem = ({ compileInto, sourceOrigin, compileServerOrigin, compileId }) => {
  const nodeSystem = new global.System.constructor()

  overrideSystemResolve({
    compileInto,
    sourceOrigin,
    compileServerOrigin,
    compileId,
    platformSystem: nodeSystem,
    resolveRootRelativeSpecifier,
  })

  overrideSystemInstantiate({
    compileInto,
    sourceOrigin,
    compileServerOrigin,
    compileId,
    fetchSource,
    platformSystem: nodeSystem,
    moduleSourceToSystemRegisteredModule,
  })

  const instantiate = nodeSystem.instantiate
  nodeSystem.instantiate = async (moduleSpecifier, moduleSpecifierFile) => {
    if (isCoreNodeModuleSpecifier(moduleSpecifier)) {
      return fromFunctionReturningNamespace(moduleSpecifier, moduleSpecifierFile, () => {
        // eslint-disable-next-line import/no-dynamic-require
        const nodeBuiltinModuleExports = require(moduleSpecifier)
        return {
          ...nodeBuiltinModuleExports,
          default: nodeBuiltinModuleExports,
        }
      })
    }
    return instantiate(moduleSpecifier, moduleSpecifierFile)
  }
  // https://github.com/systemjs/systemjs/blob/master/docs/hooks.md#createcontexturl---object
  // nodeSystem.createContext = (url) => {
  //   return { url }
  // }

  return nodeSystem
}
