import { pluginCompatMapToPlatformGroups } from "./pluginCompatMapToPlatformGroups.js"
import { platformGroupsCompose } from "./platformGroupsCompose.js"

const platformNames = [
  "chrome",
  "safari",
  "firefox",
  "edge",
  "opera",
  "android",
  "ios",
  "node",
  "electron",
]

export const pluginCompatMapToCompileGroups = (pluginCompatMap) => {
  const platformsGroups = platformNames.map((platformName) =>
    pluginCompatMapToPlatformGroups(pluginCompatMap, platformName),
  )
  const compileGroups = platformGroupsCompose(...platformsGroups)

  return compileGroups
}
