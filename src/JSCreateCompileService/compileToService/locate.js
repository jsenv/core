import Module from "module"
import { resolvePath } from "../../compileToCompileFile/helpers.js"

const locateNodeModule = (moduleLocation, location) => {
  const requireContext = new Module(location)
  requireContext.paths = Module._nodeModulePaths(location)
  return Module._resolveFilename(moduleLocation, requireContext, true)
}

// "node_modules/aaa/main.js"
// returns { dependent: "": relativeDependency: "aaa/main.js"}

// "node_modules/bbb/node_modules/aaa/index.js"
// returns { dependent: "node_modules/bbb", relativeDependency: "aaa/index.js"}
const getNodeDependentAndRelativeDependency = (fileLocation) => {
  const prefixedLocation = fileLocation[0] === "/" ? fileLocation : `/${fileLocation}`
  const pattern = "/node_modules/"
  const lastNodeModulesIndex = prefixedLocation.lastIndexOf(pattern)

  if (lastNodeModulesIndex === 0) {
    const dependent = ""
    const relativeDependency = fileLocation.slice(pattern.length - 1)
    // console.log("node location", location, "means", { dependent, relativeDependency })
    return {
      dependent,
      relativeDependency,
    }
  }

  const dependent = fileLocation.slice(0, lastNodeModulesIndex - 1)
  const relativeDependency = fileLocation.slice(lastNodeModulesIndex + pattern.length - 1)
  // console.log("node location", location, "means", { dependent, relativeDependency })
  return {
    dependent,
    relativeDependency,
  }
}

export const locate = (relativeLocation, absoluteLocation) => {
  if (relativeLocation.startsWith("node_modules/")) {
    const { dependent, relativeDependency } = getNodeDependentAndRelativeDependency(
      relativeLocation,
    )

    let nodeLocation = absoluteLocation
    if (dependent) {
      nodeLocation += `/${dependent}`
    }
    nodeLocation += `/node_modules`

    try {
      return Promise.resolve(locateNodeModule(relativeDependency, nodeLocation))
    } catch (e) {
      if (e && e.code === "MODULE_NOT_FOUND") {
        return Promise.reject({ status: 404, reason: "MODULE_NOT_FOUND" })
      }
      throw e
    }
  }

  return Promise.resolve(resolvePath(absoluteLocation, relativeLocation))
}
