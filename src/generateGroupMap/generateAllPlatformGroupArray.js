import { generatePlatformGroupArray } from "./generatePlatformGroupArray.js"
import { composeGroupArray } from "./composeGroupArray.js"

export const generateAllPlatformGroupArray = ({ featureCompatMap, platformNames }) => {
  const arrayOfGroupArray = platformNames.map((platformName) =>
    generatePlatformGroupArray({
      featureCompatMap,
      platformName,
    }),
  )
  const groupArray = composeGroupArray(...arrayOfGroupArray)
  return groupArray
}
