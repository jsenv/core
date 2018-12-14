import path from "path"
import Module from "module"
import { symlink } from "../fileHelper.js"
import { locateDefault } from "../compileToService/compileToService.js"

const selfLocalRoot = path.resolve(__dirname, "../../../")

export const locate = async ({
  localRoot,
  compileParamMap,
  compileInto,
  compileId,
  dependentFolder,
  file,
}) => {
  const compute = () => {
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

  const fileAbsolute = await compute()

  const fileIs = (name) => fileAbsolute === `${localRoot}/${compileInto}/${compileId}/${name}.js`

  if (fileIs("browserPlatform.js") || fileIs("browserPlatform.js.map")) {
    if (fileIs("browserPlatform.js")) {
      await symlink(`${selfLocalRoot}/dist/browserPlatform.js`, fileAbsolute)
      return fileAbsolute
    }
    await symlink(`${selfLocalRoot}/dist/browserPlatform.js.map`, fileAbsolute)
    return fileAbsolute
  }

  if (fileIs("browserImporter.js") || fileIs("browserImporter.js.map")) {
    const useSystemJS =
      compileParamMap[compileId] &&
      compileParamMap[compileId].pluginMap &&
      "transform-modules-systemjs" in compileParamMap[compileId].pluginMap

    if (useSystemJS) {
      if (fileIs("browserImporter.js")) {
        await symlink(`${selfLocalRoot}/dist/browserSystemImporter.js`, fileAbsolute)
        return fileAbsolute
      }
      await symlink(`${selfLocalRoot}/dist/browserSystemImporter.js.map`, fileAbsolute)
      return fileAbsolute
    }

    if (fileIs("browserImporter.js")) {
      await symlink(`${selfLocalRoot}/dist/browserNativeImporter.js`, fileAbsolute)
      return fileAbsolute
    }
    await symlink(`${selfLocalRoot}/dist/browserNativeImporter.js.map`, fileAbsolute)
    return fileAbsolute
  }

  return fileAbsolute
}

const dependencyToLocalNodeFile = (dependency, dependent, localRoot) => {
  const absoluteDependent = `${localRoot}/${dependent}`
  const requireContext = new Module(absoluteDependent)
  requireContext.paths = Module._nodeModulePaths(absoluteDependent)
  const fileAbsolute = Module._resolveFilename(dependency, requireContext, true)
  return fileAbsolute
}
