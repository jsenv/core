import { jsenvBabelPluginCompatMap } from "./jsenvBabelPluginCompatMap.js"
import { findHighestVersion } from "./private/semantic-versioning/index.js"

export const computeBabelPluginMapForPlatform = ({
  babelPluginMap,
  babelPluginCompatMap = jsenvBabelPluginCompatMap,
  platformName,
  platformVersion,
}) => {
  if (typeof babelPluginMap !== "object") {
    throw new TypeError(`babelPluginMap must be an object, got ${babelPluginMap}`)
  }
  if (typeof babelPluginCompatMap !== "object") {
    throw new TypeError(`babelPluginCompatMap must be an object, got ${babelPluginCompatMap}`)
  }
  if (typeof platformName !== "string") {
    throw new TypeError(`platformName must be a string, got ${platformName}`)
  }
  if (typeof platformVersion !== "string") {
    throw new TypeError(`platformVersion must be a string, got ${platformVersion}`)
  }

  const babelPluginMapForPlatform = {}
  Object.keys(babelPluginMap).forEach((key) => {
    const compatible = platformIsCompatibleWithFeature({
      platformName,
      platformVersion,
      platformCompatMap: key in babelPluginCompatMap ? babelPluginCompatMap[key] : {},
    })
    if (!compatible) {
      babelPluginMapForPlatform[key] = babelPluginMap[key]
    }
  })
  return babelPluginMapForPlatform
}

const platformIsCompatibleWithFeature = ({ platformName, platformVersion, platformCompatMap }) => {
  const platformCompatibleVersion = computePlatformCompatibleVersion({
    platformCompatMap,
    platformName,
  })
  const highestVersion = findHighestVersion(platformVersion, platformCompatibleVersion)
  return highestVersion === platformVersion
}

const computePlatformCompatibleVersion = ({ platformCompatMap, platformName }) => {
  return platformName in platformCompatMap ? platformCompatMap[platformName] : "Infinity"
}
