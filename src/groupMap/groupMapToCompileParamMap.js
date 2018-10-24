import { objectMapValue } from "../objectHelper.js"

export const groupMapToCompileParamMap = (groupMap, pluginMap) => {
  return objectMapValue(groupMap, ({ pluginNames }) => {
    return {
      plugins: pluginNames.map((pluginName) => pluginMap[pluginName]),
    }
  })
}
