import { compositionMappingToComposeStrict, arrayWithoutDuplicate } from "@dmail/helper"
import { compatibilityCompose } from "./compatibilityCompose.js"

export const groupCompose = compositionMappingToComposeStrict(
  {
    babelPluginNameArray: babelPluginNameArrayCompose,
    compatibility: compatibilityCompose,
  },
  () => ({
    babelPluginNameArray: [],
    compatibility: {},
  }),
)

const babelPluginNameArrayCompose = (prevPluginList, pluginList) =>
  arrayWithoutDuplicate([...prevPluginList, ...pluginList]).sort()
