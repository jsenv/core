import { jsenvBabelPluginCompatMap } from "../../jsenvBabelPluginCompatMap.js"
import { jsenvPluginCompatMap as jsenvPluginCompatMapFallback } from "../../jsenvPluginCompatMap.js"
import { computeBabelPluginMapForPlatform } from "../../computeBabelPluginMapForPlatform.js"
import { computeJsenvPluginMapForPlatform } from "../../computeJsenvPluginMapForPlatform.js"
import { findHighestVersion, versionCompare } from "../semantic-versioning/index.js"
import { groupHaveSameRequirements } from "./groupHaveSameRequirements.js"

export const generatePlatformGroupArray = ({
  babelPluginMap,
  jsenvPluginMap,
  babelPluginCompatMap = jsenvBabelPluginCompatMap,
  jsenvPluginCompatMap = jsenvPluginCompatMapFallback,
  platformName,
}) => {
  const versionArray = []
  Object.keys(babelPluginMap).forEach((babelPluginKey) => {
    if (babelPluginKey in babelPluginCompatMap) {
      const babelPluginCompat = babelPluginCompatMap[babelPluginKey]
      if (platformName in babelPluginCompat) {
        const version = String(babelPluginCompat[platformName])
        if (!versionArray.includes(version)) {
          versionArray.push(version)
        }
      }
    }
  })
  Object.keys(jsenvPluginMap).forEach((jsenvPluginKey) => {
    if (jsenvPluginKey in jsenvPluginCompatMap) {
      const jsenvPluginCompat = jsenvPluginCompatMap[jsenvPluginKey]
      if (platformName in jsenvPluginCompat) {
        const version = String(jsenvPluginCompat[platformName])
        if (!versionArray.includes(version)) {
          versionArray.push(version)
        }
      }
    }
  })
  versionArray.push("0.0.0")
  versionArray.sort(versionCompare)

  const platformGroupArray = []

  versionArray.forEach((version) => {
    const babelPluginMapForPlatform = computeBabelPluginMapForPlatform({
      babelPluginMap,
      babelPluginCompatMap,
      platformName,
      platformVersion: version,
    })
    const babelPluginRequiredNameArray = Object.keys(babelPluginMap)
      .filter((babelPluginKey) => babelPluginKey in babelPluginMapForPlatform)
      .sort()
    const jsenvPluginMapForPlatform = computeJsenvPluginMapForPlatform({
      jsenvPluginMap,
      jsenvPluginCompatMap,
      platformName,
      platformVersion: version,
    })
    const jsenvPluginRequiredNameArray = Object.keys(jsenvPluginMap)
      .filter((jsenvPluginKey) => jsenvPluginKey in jsenvPluginMapForPlatform)
      .sort()

    const group = {
      babelPluginRequiredNameArray,
      jsenvPluginRequiredNameArray,
      platformCompatMap: {
        [platformName]: version,
      },
    }

    const groupWithSameRequirements = platformGroupArray.find((platformGroupCandidate) =>
      groupHaveSameRequirements(platformGroupCandidate, group),
    )

    if (groupWithSameRequirements) {
      groupWithSameRequirements.platformCompatMap[platformName] = findHighestVersion(
        groupWithSameRequirements.platformCompatMap[platformName],
        version,
      )
    } else {
      platformGroupArray.push(group)
    }
  })

  return platformGroupArray
}
