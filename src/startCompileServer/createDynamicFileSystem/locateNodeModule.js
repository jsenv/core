import Module from "module"

export const locateNodeModule = (moduleLocation, location) => {
  const requireContext = new Module(location)
  requireContext.paths = Module._nodeModulePaths(location)
  return Module._resolveFilename(moduleLocation, requireContext, true)
}
