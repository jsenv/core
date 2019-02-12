import "systemjs/dist/system.js"
import { resolveRootRelativeSpecifier } from "@jsenv/module-resolution/src/resolveRootRelativeSpecifier.js"
import { overrideSystemResolve } from "../../overrideSystemResolve.js"
import { overrideSystemInstantiate } from "../../overrideSystemInstantiate.js"
import { moduleSourceToSystemRegisteredModule } from "../moduleSourceToSystemRegisteredModule.js"

export const createBrowserSystem = ({
  compileInto,
  sourceRootHref, // in browser it is undefined because it could be a sensitive information
  compileServerOrigin,
  compileId,
  fetchSource,
}) => {
  const browserSystem = new window.System.constructor()

  overrideSystemResolve({
    compileInto,
    compileServerOrigin,
    compileId,
    platformSystem: browserSystem,
    resolveRootRelativeSpecifier,
  })

  overrideSystemInstantiate({
    compileInto,
    sourceRootHref,
    compileServerOrigin,
    compileId,
    fetchSource,
    platformSystem: browserSystem,
    moduleSourceToSystemRegisteredModule,
  })

  return browserSystem
}
