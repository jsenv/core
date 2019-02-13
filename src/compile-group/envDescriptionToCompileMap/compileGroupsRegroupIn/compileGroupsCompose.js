import { compositionMappingToComposeStrict, arrayWithoutDuplicate } from "@dmail/helper"
import { compatibilityDescriptionCompose } from "../compatibilityDescriptionCompose.js"

const babelPluginNameArrayCompose = (prevPluginList, pluginList) =>
  arrayWithoutDuplicate([...prevPluginList, ...pluginList]).sort()

export const compileGroupsCompose = compositionMappingToComposeStrict(
  {
    babelPluginNameArray: babelPluginNameArrayCompose,
    compatibilityDescription: compatibilityDescriptionCompose,
  },
  () => ({
    babelPluginNameArray: [],
    compatibilityDescription: {},
  }),
)
