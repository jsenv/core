import "systemjs/dist/system.js"
import { isCoreNodeModuleSpecifier, resolveAbsoluteModuleSpecifier } from "@jsenv/module-resolution"
import { overrideSystemResolve } from "../../overrideSystemResolve.js"
import { overrideSystemInstantiate } from "../../overrideSystemInstantiate.js"
import { fromFunctionReturningNamespace } from "../../registerParamFrom.js"

export const createNodeSystem = ({
  remoteRoot,
  localRoot,
  compileInto,
  compileId,
  fetchSource,
  evalSource,
}) => {
  const nodeSystem = new global.System.constructor()

  overrideSystemResolve({
    System: nodeSystem,
    resolveAbsoluteModuleSpecifier,
    remoteRoot,
    compileInto,
    compileId,
  })
  overrideSystemInstantiate({
    System: nodeSystem,
    remoteRoot,
    localRoot,
    compileInto,
    compileId,
    fetchSource,
    evalSource,
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
  nodeSystem.createContext = (url) => {
    return { url }
  }
  return nodeSystem
}
