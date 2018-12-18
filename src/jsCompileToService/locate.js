import Module from "module"
// import { symlink } from "../fileHelper.js"
import { locateDefault } from "../compileToService/compileToService.js"
import { localRoot as selfLocalRoot } from "../localRoot.js"

export const locate = async ({ localRoot, dependentFolder, file }) => {
  // future consumer of dev-server will use
  // 'node_modules/dev-server/dist/browserSystemImporter.js'
  // to get file from this module
  // in order to test this behaviour, when we are working on this module
  // 'node_modules/dev-server` is an alias to localRoot
  if (localRoot === selfLocalRoot) {
    if (file.startsWith("node_modules/dev-server/")) {
      file = file.slice("node_modules/dev-server/".length)
    }
  }

  if (file.startsWith("node_modules/")) {
    try {
      const dependency = file.slice("node_modules/".length)
      return dependencyToLocalNodeFile(dependency, dependentFolder, localRoot)
    } catch (e) {
      if (e && e.code === "MODULE_NOT_FOUND") {
        return null
      }
      throw e
    }
  }

  return locateDefault({ localRoot, dependentFolder, file })
}

const dependencyToLocalNodeFile = (dependency, dependent, localRoot) => {
  const absoluteDependent = `${localRoot}/${dependent}`
  const requireContext = new Module(absoluteDependent)
  requireContext.paths = Module._nodeModulePaths(absoluteDependent)
  const fileAbsolute = Module._resolveFilename(dependency, requireContext, true)
  return fileAbsolute
}
