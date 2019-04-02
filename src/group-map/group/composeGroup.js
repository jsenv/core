import { compositionMappingToComposeStrict } from "/node_modules/@dmail/helper/index.js"
import { composePlatformCompatibility } from "../platform-compatibility/composePlatformCompatibility.js"
import { composeIncompatibleNameArray } from "./composeIncompatibleNameArray.js"

export const composeGroup = compositionMappingToComposeStrict(
  {
    incompatibleNameArray: composeIncompatibleNameArray,
    platformCompatibility: composePlatformCompatibility,
  },
  () => ({
    incompatibleNameArray: [],
    platformCompatibility: {},
  }),
)
