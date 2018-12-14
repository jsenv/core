import Module from "module"

const dependencyToLocalNodeFile = (dependency, dependent, localRoot) => {
  const absoluteDependent = `${localRoot}/${dependent}`
  const requireContext = new Module(absoluteDependent)
  requireContext.paths = Module._nodeModulePaths(absoluteDependent)
  const fileAbsolute = Module._resolveFilename(dependency, requireContext, true)
  // we must return a relativeFile
  // if the resolved file is not relative to localRoot we must
  // return where we want to store it vs where it truly is
  return fileAbsolute
}

export const locate = ({ localRoot, dependentFolder, file }) => {
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

  return dependentFolder ? `${dependentFolder}/${file}` : file
}
