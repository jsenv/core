import "systemjs/dist/system.js"
import { resolveRootRelativeSpecifier } from "@jsenv/module-resolution/src/resolveRootRelativeSpecifier.js"
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
    resolveRootRelativeSpecifier,
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
