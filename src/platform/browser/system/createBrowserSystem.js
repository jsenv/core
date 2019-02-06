import "systemjs/dist/system.js"
import { resolveAbsoluteModuleSpecifier } from "@jsenv/module-resolution/src/resolveAbsoluteModuleSpecifier.js"
import { overrideSystemResolve } from "../../overrideSystemResolve.js"
import { overrideSystemInstantiate } from "../../overrideSystemInstantiate.js"
import { moduleSourceToSystemRegisteredModule } from "../moduleSourceToSystemRegisteredModule.js"

export const createBrowserSystem = ({
  localRoot, // in browser it is undefined because it could be a sensitive information
  compileInto,
  compileId,
  remoteRoot,
  fetchSource,
}) => {
  const browserSystem = new window.System.constructor()

  overrideSystemResolve({
    compileInto,
    compileId,
    remoteRoot,
    platformSystem: browserSystem,
    resolveAbsoluteModuleSpecifier,
  })

  overrideSystemInstantiate({
    localRoot,
    compileInto,
    compileId,
    remoteRoot,
    fetchSource,
    platformSystem: browserSystem,
    moduleSourceToSystemRegisteredModule,
  })

  return browserSystem
}
