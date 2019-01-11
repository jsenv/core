import { compositionMappingToComposeStrict, arrayWithoutDuplicate } from "@dmail/helper"
import { compatMapCompose } from "../compatMapCompose.js"

const composePluginNames = (prevPluginList, pluginList) =>
  arrayWithoutDuplicate([...prevPluginList, ...pluginList]).sort()

export const compileGroupsCompose = compositionMappingToComposeStrict(
  {
    pluginNames: composePluginNames,
    compatMap: compatMapCompose,
  },
  () => ({
    pluginNames: [],
    compatMap: {},
  }),
)
