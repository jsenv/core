import path from "path"
import Module from "module"

export const projectFileToNodeModuleFile = (projectFile, importerFile) => {
  const dependency = projectFile.slice("node_modules/".length)
  const baseFolder = path.dirname(importerFile)
  const requireContext = new Module(baseFolder)
  requireContext.paths = Module._nodeModulePaths(baseFolder)

  try {
    const file = Module._resolveFilename(dependency, requireContext, true)
    return file
  } catch (e) {
    if (e && e.code === "MODULE_NOT_FOUND") {
      return null
    }
    throw e
  }
}
