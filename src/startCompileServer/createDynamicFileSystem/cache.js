import { resolvePath } from "./helpers.js"
import { locateNodeModule } from "./locateNodeModule.js"

export const JSON_FILE = "cache.json"

// "node_modules/aaa/main.js"
// returns { dependent: "": relativeDependency: "aaa/main.js"}

// "node_modules/bbb/node_modules/aaa/index.js"
// returns { dependent: "node_modules/bbb", relativeDependency: "aaa/index.js"}
const getNodeDependentAndRelativeDependency = (location) => {
  const prefixedLocation = location[0] === "/" ? location : `/${location}`
  const pattern = "/node_modules/"
  const lastNodeModulesIndex = prefixedLocation.lastIndexOf(pattern)

  if (lastNodeModulesIndex === 0) {
    const dependent = ""
    const relativeDependency = location.slice(pattern.length - 1)
    // console.log("node location", location, "means", { dependent, relativeDependency })
    return {
      dependent,
      relativeDependency,
    }
  }

  const dependent = location.slice(0, lastNodeModulesIndex - 1)
  const relativeDependency = location.slice(lastNodeModulesIndex + pattern.length - 1)
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

    let nodeLocation = location
    if (dependent) {
      nodeLocation += `/${dependent}`
    }
    nodeLocation += `/node_modules`

    // const action = createAction()
    // try {
    // console.log("resolve node module", relativeDependency, "from", nodeLocation)
    return locateNodeModule(relativeDependency, nodeLocation)
    // console.log("module found at", moduleLocation)
    //   action.pass(moduleLocation)
    // } catch (e) {
    //   if (e && e.code === "MODULE_NOT_FOUND") {
    //     // console.log("no module found")
    //     action.fail({ status: 404 })
    //   } else {
    //     throw e
    //   }
    // }
    // return action
  }

  return resolvePath(absoluteLocation, relativeLocation)
}
