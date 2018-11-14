import Module from "module"

const dependencyToLocalNodeFile = (dependency, dependent, localRoot) => {
  const absoluteDependent = `${localRoot}/${dependent}`
  const requireContext = new Module(absoluteDependent)
  requireContext.paths = Module._nodeModulePaths(absoluteDependent)
  return Module._resolveFilename(dependency, requireContext, true)
}

export const locate = ({ localRoot, dependentFolder, file }) => {
  if (file.startsWith("node_modules/")) {
    try {
      const dependency = file.slice("node_modules/".length)
      return dependencyToLocalNodeFile(dependency, dependentFolder, localRoot)
    } catch (e) {
      if (e && e.code === "MODULE_NOT_FOUND") {
        return Promise.reject({ status: 404, reason: "MODULE_NOT_FOUND" })
      }
      throw e
    }
  }

  return dependentFolder ? `${dependentFolder}/${file}` : file
}
