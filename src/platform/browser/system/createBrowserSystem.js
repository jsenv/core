import "../../../systemjs/system.js" // awaiting https://github.com/systemjs/systemjs/issues/1898
import { overrideSystemInstantiate } from "../../overrideSystemInstantiate.js"
import { moduleSourceToSystemRegisteredModule } from "../moduleSourceToSystemRegisteredModule.js"

export const createBrowserSystem = ({
  compileInto,
  sourceOrigin, // in browser it is undefined because it could be a sensitive information
  compileServerOrigin,
  compileId,
  fetchSource,
}) => {
  const browserSystem = new window.System.constructor()

  overrideSystemInstantiate({
    compileInto,
    sourceOrigin,
    compileServerOrigin,
    compileId,
    fetchSource,
    platformSystem: browserSystem,
    moduleSourceToSystemRegisteredModule,
  })

  return browserSystem
}
