import { resolveAPossibleNodeModuleFile } from "@jsenv/module-resolution"

export const resolveDependenciesRealFile = (dependencies) => {
  return dependencies.map((dependency) => {
    const nodeModuleFile = resolveAPossibleNodeModuleFile(dependency.file)
    if (nodeModuleFile && nodeModuleFile !== dependency.file) {
      return {
        ...dependency,
        realFile: nodeModuleFile,
      }
    }
    return dependency
  })
}
