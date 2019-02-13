import { compatibilityDescriptionToGroupArrayForPlatform } from "./compatibilityDescriptionToGroupArrayForPlatform.js"
import { groupArrayCompose } from "./groupArrayCompose.js"

const defaultPlatformNames = [
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

export const compatibilityDescriptionToGroupArray = ({
  compatibilityDescription,
  platformNames = defaultPlatformNames,
}) => {
  const arrayOfGroupArray = platformNames.map((platformName) =>
    compatibilityDescriptionToGroupArrayForPlatform({
      compatibilityDescription,
      platformName,
    }),
  )
  const groupArray = groupArrayCompose(...arrayOfGroupArray)
  return groupArray
}
