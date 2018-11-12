import Module from "module"

const dependencyToLocalNodeFile = (dependency, localDependent) => {
  const requireContext = new Module(localDependent)
  requireContext.paths = Module._nodeModulePaths(localDependent)
  return Module._resolveFilename(dependency, requireContext, true)
}

export const locate = (file, localRoot) => {
  if (file.startsWith("node_modules/")) {
    try {
      const dependency = file.slice("node_modules/".length)
      return dependencyToLocalNodeFile(dependency, localRoot)
    } catch (e) {
      if (e && e.code === "MODULE_NOT_FOUND") {
        return Promise.reject({ status: 404, reason: "MODULE_NOT_FOUND" })
      }
      throw e
    }
  }

  return `${localRoot}/${file}`
}
