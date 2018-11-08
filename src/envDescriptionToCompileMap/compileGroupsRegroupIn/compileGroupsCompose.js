import { composeMapToComposeStrict } from "../../objectHelper.js"
import { compatMapCompose } from "../compatMapCompose.js"

const composePluginNames = (pluginList, secondPluginList) => {
  return [
    ...pluginList,
    ...secondPluginList.filter((plugin) => pluginList.indexOf(plugin) === -1),
  ].sort()
}

export const compileGroupsCompose = composeMapToComposeStrict(
  {
    pluginNames: composePluginNames,
    compatMap: compatMapCompose,
  },
  () => ({
    pluginNames: [],
    compatMap: {},
  }),
)
