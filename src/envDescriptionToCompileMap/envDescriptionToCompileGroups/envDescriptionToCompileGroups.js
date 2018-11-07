import { pluginCompatMapToPlatformGroups } from "./pluginCompatMapToPlatformGroups.js"
import { platformGroupsCompose } from "./platformGroupsCompose.js"

export const envDescriptionToCompileGroups = ({ pluginCompatMap, platformNames }) => {
  const platformsGroups = Object.keys(platformNames).map((platformName) =>
    pluginCompatMapToPlatformGroups(pluginCompatMap, platformName),
  )
  const compileGroups = platformGroupsCompose(...platformsGroups)

  return compileGroups
}
