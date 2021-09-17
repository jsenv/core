import {
  findHighestVersion,
  versionCompare,
} from "../semantic-versioning/index.js"
import { jsenvBabelPluginCompatMap } from "./jsenvBabelPluginCompatMap.js"
import { jsenvPluginCompatMap as jsenvPluginCompatMapFallback } from "./jsenvPluginCompatMap.js"
import { computeBabelPluginMapForRuntime } from "./computeBabelPluginMapForRuntime.js"
import { computeJsenvPluginMapForRuntime } from "./computeJsenvPluginMapForRuntime.js"
import { groupHaveSameRequirements } from "./groupHaveSameRequirements.js"

export const generateRuntimeGroupArray = ({
  babelPluginMap,
  jsenvPluginMap,
  babelPluginCompatMap = jsenvBabelPluginCompatMap,
  jsenvPluginCompatMap = jsenvPluginCompatMapFallback,
  runtimeName,
}) => {
  const versionArray = []
  Object.keys(babelPluginMap).forEach((babelPluginKey) => {
    if (babelPluginKey in babelPluginCompatMap) {
      const babelPluginCompat = babelPluginCompatMap[babelPluginKey]
      if (runtimeName in babelPluginCompat) {
        const version = String(babelPluginCompat[runtimeName])
        if (!versionArray.includes(version)) {
          versionArray.push(version)
        }
      }
    }
  })
  Object.keys(jsenvPluginMap).forEach((jsenvPluginKey) => {
    if (jsenvPluginKey in jsenvPluginCompatMap) {
      const jsenvPluginCompat = jsenvPluginCompatMap[jsenvPluginKey]
      if (runtimeName in jsenvPluginCompat) {
        const version = String(jsenvPluginCompat[runtimeName])
        if (!versionArray.includes(version)) {
          versionArray.push(version)
        }
      }
    }
  })
  versionArray.push("0.0.0")
  versionArray.sort(versionCompare)

  const runtimeGroupArray = []

  versionArray.forEach((version) => {
    const babelPluginMapForRuntime = computeBabelPluginMapForRuntime({
      babelPluginMap,
      babelPluginCompatMap,
      runtimeName,
      runtimeVersion: version,
    })
    const babelPluginRequiredNameArray = Object.keys(babelPluginMap)
      .filter((babelPluginKey) => babelPluginKey in babelPluginMapForRuntime)
      .sort()
    const jsenvPluginMapForRuntime = computeJsenvPluginMapForRuntime({
      jsenvPluginMap,
      jsenvPluginCompatMap,
      runtimeName,
      runtimeVersion: version,
    })
    const jsenvPluginRequiredNameArray = Object.keys(jsenvPluginMap)
      .filter((jsenvPluginKey) => jsenvPluginKey in jsenvPluginMapForRuntime)
      .sort()

    const group = {
      babelPluginRequiredNameArray,
      jsenvPluginRequiredNameArray,
      runtimeCompatMap: {
        [runtimeName]: version,
      },
    }

    const groupWithSameRequirements = runtimeGroupArray.find(
      (runtimeGroupCandidate) =>
        groupHaveSameRequirements(runtimeGroupCandidate, group),
    )

    if (groupWithSameRequirements) {
      groupWithSameRequirements.runtimeCompatMap[runtimeName] =
        findHighestVersion(
          groupWithSameRequirements.runtimeCompatMap[runtimeName],
          version,
        )
    } else {
      runtimeGroupArray.push(group)
    }
  })

  return runtimeGroupArray
}
