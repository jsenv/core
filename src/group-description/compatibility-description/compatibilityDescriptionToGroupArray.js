import { compatibilityDescriptionToGroupArrayForPlatform } from "./compatibilityDescriptionToGroupArrayForPlatform.js"
import { composeGroupArray } from "../group-array/composeGroupArray.js"

export const compatibilityDescriptionToGroupArray = ({
  compatibilityDescription,
  platformNames,
}) => {
  const arrayOfGroupArray = platformNames.map((platformName) =>
    compatibilityDescriptionToGroupArrayForPlatform({
      compatibilityDescription,
      platformName,
    }),
  )
  const groupArray = composeGroupArray(...arrayOfGroupArray)
  return groupArray
}
