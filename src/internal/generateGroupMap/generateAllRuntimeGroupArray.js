import { generateRuntimeGroupArray } from "./generateRuntimeGroupArray.js"
import { composeGroupArray } from "./composeGroupArray.js"

export const generateAllRuntimeGroupArray = ({
  babelPluginMap,
  jsenvPluginMap,
  babelPluginCompatMap,
  jsenvPluginCompatMap,
  runtimeNames,
}) => {
  const arrayOfGroupArray = runtimeNames.map((runtimeName) =>
    generateRuntimeGroupArray({
      babelPluginMap,
      jsenvPluginMap,
      babelPluginCompatMap,
      jsenvPluginCompatMap,
      runtimeName,
    }),
  )
  const groupArray = composeGroupArray(...arrayOfGroupArray)
  return groupArray
}
