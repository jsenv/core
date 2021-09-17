import { versionCompare } from "../../semantic-versioning/index.js"
import { createRuntimeCompatForRuntime } from "./for_runtime.js"
import { composeRuntimeCompatMap } from "./runtime_compat_composition.js"

export const createRuntimeCompatForEveryRuntimeVersions = ({
  runtimeSupport,

  babelPluginMap,
  babelPluginCompatMap,

  jsenvPluginMap,
  jsenvPluginCompatMap,
}) => {
  const runtimeCompatsForEveryVersion = []
  Object.keys(runtimeSupport).forEach((runtimeName) => {
    const runtimeVersions = getAllRuntimeVersions({
      runtimeName,

      babelPluginMap,
      babelPluginCompatMap,

      jsenvPluginMap,
      jsenvPluginCompatMap,
    })

    runtimeVersions.forEach((runtimeVersion) => {
      const runtimeCompat = createRuntimeCompatForRuntime({
        runtimeName,
        runtimeVersion,

        babelPluginMap,
        babelPluginCompatMap,

        jsenvPluginMap,
        jsenvPluginCompatMap,
      })

      const runtimeCompatWithSameRequirements =
        runtimeCompatsForEveryVersion.find((runtimeCompatCandidate) => {
          return sameRequirements(runtimeCompatCandidate, runtimeCompat)
        })

      if (runtimeCompatWithSameRequirements) {
        runtimeCompatWithSameRequirements.runtimeCompatMap =
          composeRuntimeCompatMap(
            runtimeCompatWithSameRequirements.runtimeCompatMap,
            runtimeCompat.runtimeCompatMap,
          )
      } else {
        runtimeCompatsForEveryVersion.push(runtimeCompat)
      }
    })
  })
  return runtimeCompatsForEveryVersion
}

const sameRequirements = (left, right) => {
  return (
    left.babelPluginRequiredNameArray.join("") ===
      right.babelPluginRequiredNameArray.join("") &&
    left.jsenvPluginRequiredNameArray.join("") ===
      right.jsenvPluginRequiredNameArray.join("")
  )
}

const getAllRuntimeVersions = ({
  runtimeName,

  babelPluginMap,
  babelPluginCompatMap,

  jsenvPluginMap,
  jsenvPluginCompatMap,
}) => {
  const runtimeVersions = []
  Object.keys(babelPluginMap).forEach((babelPluginName) => {
    const babelPluginCompat = babelPluginCompatMap[babelPluginName]
    if (babelPluginCompat) {
      const runtimeVersion = babelPluginCompat[runtimeName]
      if (!runtimeVersions.includes(runtimeVersion)) {
        runtimeVersions.push(runtimeVersion)
      }
    }
  })
  Object.keys(jsenvPluginMap).forEach((jsenvPluginName) => {
    const jsenvPluginCompat = jsenvPluginCompatMap[jsenvPluginName]
    if (jsenvPluginCompat) {
      const runtimeVersion = jsenvPluginCompat[runtimeName]
      if (!runtimeVersions.includes(runtimeVersion)) {
        runtimeVersions.push(runtimeVersion)
      }
    }
  })

  runtimeVersions.push("0.0.0")
  runtimeVersions.sort(versionCompare)

  return runtimeVersions
}
