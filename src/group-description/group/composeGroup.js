import { compositionMappingToComposeStrict } from "/node_modules/@dmail/helper/index.js"
import { composeCompatibility } from "../compatibility-description/composeCompatibility.js"
import { composeIncompatibleNameArray } from "../compatibility-description/composeIncompatibleNameArray.js"

export const composeGroup = compositionMappingToComposeStrict(
  {
    incompatibleNameArray: composeIncompatibleNameArray,
    compatibility: composeCompatibility,
  },
  () => ({
    incompatibleNameArray: [],
    compatibility: {},
  }),
)
