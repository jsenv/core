import { computePlatformGroupArray } from "./computePlatformGroupArray.js"
import { composeGroupArray } from "./composeGroupArray.js"

export const computeEveryPlatformGroupArray = ({ featureCompatMap, platformNames }) => {
  const arrayOfGroupArray = platformNames.map((platformName) =>
    computePlatformGroupArray({
      featureCompatMap,
      platformName,
    }),
  )
  const groupArray = composeGroupArray(...arrayOfGroupArray)
  return groupArray
}
