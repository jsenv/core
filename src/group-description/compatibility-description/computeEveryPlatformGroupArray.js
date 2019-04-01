import { computePlatformGroupArray } from "./computePlatformGroupArray.js"
import { composeGroupArray } from "./composeGroupArray.js"

export const computeEveryPlatformGroupArray = ({ compatibilityDescription, platformNames }) => {
  const arrayOfGroupArray = platformNames.map((platformName) =>
    computePlatformGroupArray({
      compatibilityDescription,
      platformName,
    }),
  )
  const groupArray = composeGroupArray(...arrayOfGroupArray)
  return groupArray
}
