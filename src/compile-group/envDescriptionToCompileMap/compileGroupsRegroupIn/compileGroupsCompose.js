import { compositionMappingToComposeStrict, arrayWithoutDuplicate } from "@dmail/helper"
import { compatMapCompose } from "../compatMapCompose.js"

const composePluginNames = (prevPluginList, pluginList) =>
  arrayWithoutDuplicate([...prevPluginList, ...pluginList]).sort()

export const compileGroupsCompose = compositionMappingToComposeStrict(
  {
    babelPluginNameArray: composePluginNames,
    compatMap: compatMapCompose,
  },
  () => ({
    babelPluginNameArray: [],
    compatMap: {},
  }),
)
