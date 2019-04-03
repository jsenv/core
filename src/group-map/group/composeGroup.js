import { compositionMappingToComposeStrict } from "/node_modules/@dmail/helper/index.js"
import { composePlatformCompatMap } from "../platform-compat-map/composePlatformCompatMap.js"
import { composeIncompatibleNameArray } from "./composeIncompatibleNameArray.js"

export const composeGroup = compositionMappingToComposeStrict(
  {
    incompatibleNameArray: composeIncompatibleNameArray,
    platformCompatMap: composePlatformCompatMap,
  },
  () => ({
    incompatibleNameArray: [],
    platformCompatMap: {},
  }),
)
