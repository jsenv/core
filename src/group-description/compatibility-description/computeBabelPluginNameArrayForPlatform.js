import { versionIsBelow } from "../../semantic-versioning/index.js"

export const computeBabelPluginNameArrayForPlatform = ({
  babelPluginDescription,
  platformName,
  platformVersion,
  compatibilityDescription,
}) => {
  const babelPluginDescriptionForPlatform = computeBabelPluginDescriptionForPlatform({
    babelPluginDescription,
    platformName,
    platformVersion,
    compatibilityDescription,
  })
  const babelPluginNameArray = Object.keys(babelPluginDescriptionForPlatform)
  return babelPluginNameArray
}

const computeBabelPluginDescriptionForPlatform = ({
  babelPluginDescription,
  platformName,
  platformVersion,
  compatibilityDescription,
}) => {
  const babelPluginDescriptionForPlatform = {}

  Object.keys(babelPluginDescription).forEach((babelPluginName) => {
    const compatible = isPlatformCompatible(
      babelPluginName in compatibilityDescription ? compatibilityDescription[babelPluginName] : {},
      platformName,
      platformVersion,
    )
    if (compatible) {
      babelPluginDescriptionForPlatform[babelPluginName] = babelPluginDescription[babelPluginName]
    }
  })

  return babelPluginDescriptionForPlatform
}

const isPlatformCompatible = (compatibility, platformName, platformVersion) => {
  const compatibleVersion = pluginCompatMapToPlatformVersion(compatibility, platformName)
  return versionIsBelow(platformVersion, compatibleVersion)
}

const pluginCompatMapToPlatformVersion = (compatibility, platformName) => {
  return platformName in compatibility ? compatibility[platformName] : "Infinity"
}
