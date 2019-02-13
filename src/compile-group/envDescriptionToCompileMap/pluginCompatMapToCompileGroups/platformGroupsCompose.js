import { compatMapCompose } from "../compatMapCompose.js"

export const platformGroupsCompose = (...platformGroups) => {
  return platformGroups.reduce(platformGroupReducer, [])
}

const platformGroupReducer = (previous, platformGroup) => {
  const groups = []

  previous.forEach((firstPlatformGroup) => {
    groups.push({
      babelPluginNameArray: firstPlatformGroup.babelPluginNameArray.slice(),
      compatMap: { ...firstPlatformGroup.compatMap },
    })
  })

  platformGroup.forEach((secondPlatformGroup) => {
    const babelPluginNameArray = secondPlatformGroup.babelPluginNameArray
    const existingGroup = groups.find((platformGroup) => {
      return babelPluginNameArray.join("") === platformGroup.babelPluginNameArray.join("")
    })
    if (existingGroup) {
      existingGroup.compatMap = compatMapCompose(
        existingGroup.compatMap,
        secondPlatformGroup.compatMap,
      )
    } else {
      groups.push({
        babelPluginNameArray: babelPluginNameArray.slice(),
        compatMap: { ...secondPlatformGroup.compatMap },
      })
    }
  })

  return groups
}
