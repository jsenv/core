import { objectMapValue } from "../objectHelper.js"
import { groupToBabelPluginDescription } from "./group/groupToBabelPluginDescription.js"

export const groupDescriptionToCompileDescription = (
  groupDescription,
  babelPluginDescription = {},
) => {
  return objectMapValue(groupDescription, (group) => {
    return {
      babelPluginDescription: groupToBabelPluginDescription(group, babelPluginDescription),
    }
  })
}
