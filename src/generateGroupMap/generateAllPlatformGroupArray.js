import { generatePlatformGroupArray } from "./generatePlatformGroupArray.js"
import { composeGroupArray } from "./composeGroupArray.js"

export const generateAllPlatformGroupArray = ({
  babelPluginMap,
  jsenvPluginMap,
  babelPluginCompatMap,
  jsenvPluginCompatMap,
  platformNames,
}) => {
  const arrayOfGroupArray = platformNames.map((platformName) =>
    generatePlatformGroupArray({
      babelPluginMap,
      jsenvPluginMap,
      babelPluginCompatMap,
      jsenvPluginCompatMap,
      platformName,
    }),
  )
  const groupArray = composeGroupArray(...arrayOfGroupArray)
  return groupArray
}
