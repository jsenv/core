import { jsenvPluginCompatMap as jsenvPluginCompatMapFallback } from "./jsenvPluginCompatMap.js"
import { findHighestVersion } from "./private/semantic-versioning/index.js"

export const computeJsenvPluginMapForPlatform = ({
  jsenvPluginMap,
  jsenvPluginCompatMap = jsenvPluginCompatMapFallback,
  platformName,
  platformVersion,
}) => {
  if (typeof jsenvPluginMap !== "object") {
    throw new TypeError(`jsenvPluginMap must be a object, got ${jsenvPluginMap}`)
  }
  if (typeof jsenvPluginCompatMap !== "object") {
    throw new TypeError(`jsenvPluginCompatMap must be a string, got ${jsenvPluginCompatMap}`)
  }
  if (typeof platformName !== "string") {
    throw new TypeError(`platformName must be a string, got ${platformName}`)
  }
  if (typeof platformVersion !== "string") {
    throw new TypeError(`platformVersion must be a string, got ${platformVersion}`)
  }

  const jsenvPluginMapForPlatform = {}
  Object.keys(jsenvPluginMap).forEach((key) => {
    const compatible = platformIsCompatibleWithFeature({
      platformName,
      platformVersion,
      featureCompat: key in jsenvPluginCompatMap ? jsenvPluginCompatMap[key] : {},
    })
    if (!compatible) {
      jsenvPluginMapForPlatform[key] = jsenvPluginMap[key]
    }
  })
  return jsenvPluginMapForPlatform
}

const platformIsCompatibleWithFeature = ({ platformName, platformVersion, featureCompat }) => {
  const platformCompatibleVersion = computePlatformCompatibleVersion({
    featureCompat,
    platformName,
  })
  const highestVersion = findHighestVersion(platformVersion, platformCompatibleVersion)
  return highestVersion === platformVersion
}

const computePlatformCompatibleVersion = ({ featureCompat, platformName }) => {
  return platformName in featureCompat ? featureCompat[platformName] : "Infinity"
}
