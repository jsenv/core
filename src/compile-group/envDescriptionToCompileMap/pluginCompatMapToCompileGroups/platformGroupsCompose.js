import { compatibilityDescriptionCompose } from "../compatibilityDescriptionCompose.js"

export const platformGroupsCompose = (...platformGroups) => {
  return platformGroups.reduce(platformGroupReducer, [])
}

const platformGroupReducer = (previous, platformGroup) => {
  const groups = []

  previous.forEach((firstPlatformGroup) => {
    groups.push({
      babelPluginNameArray: firstPlatformGroup.babelPluginNameArray.slice(),
      compatibilityDescription: { ...firstPlatformGroup.compatibilityDescription },
    })
  })

  platformGroup.forEach((secondPlatformGroup) => {
    const babelPluginNameArray = secondPlatformGroup.babelPluginNameArray
    const existingGroup = groups.find((platformGroup) => {
      return babelPluginNameArray.join("") === platformGroup.babelPluginNameArray.join("")
    })
    if (existingGroup) {
      existingGroup.compatibilityDescription = compatibilityDescriptionCompose(
        existingGroup.compatibilityDescription,
        secondPlatformGroup.compatibilityDescription,
      )
    } else {
      groups.push({
        babelPluginNameArray: babelPluginNameArray.slice(),
        compatibilityDescription: { ...secondPlatformGroup.compatibilityDescription },
      })
    }
  })

  return groups
}
