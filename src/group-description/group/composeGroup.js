import { compositionMappingToComposeStrict } from "@dmail/helper"
import { composeCompatibility } from "../compatibility/composeCompatibility.js"
import { composeBabelPluginNameArray } from "../babel-plugin-name-array/composeBabelPluginNameArray.js"

export const composeGroup = compositionMappingToComposeStrict(
  {
    babelPluginNameArray: composeBabelPluginNameArray,
    compatibility: composeCompatibility,
  },
  () => ({
    babelPluginNameArray: [],
    compatibility: {},
  }),
)
