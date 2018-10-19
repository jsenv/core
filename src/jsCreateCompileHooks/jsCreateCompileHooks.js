import { pluginNameToPlugin as defaultPluginNameToPlugin } from "@dmail/project-structure-compile-babel"
import { getCompatGroupMap, DEFAULT_ID } from "./getCompatGroupMap.js"
import { objectMapValue } from "../objectHelper.js"

const createCompileIdToParam = (compatGroupMap, pluginNameToPlugin, pluginNameToOptions) => {
  return (compileId) => {
    const pluginNames = compatGroupMap[compileId].pluginNames

    return {
      // this is how babel expect us to pass option to plugin
      plugins: pluginNames.map((pluginName) => {
        return [pluginNameToPlugin(pluginName), pluginNameToOptions(pluginName) || {}]
      }),
    }
  }
}

const compatGroupMapToClientCompatGroupMap = (compatGroupMap) => {
  return objectMapValue(compatGroupMap, ({ compatMap }) => compatMap)
}

export const jsCreateCompileHooks = ({
  configLocation,

  stats,
  compatMap,
  size,
  platformNames,
  moduleOutput = "systemjs",
  pluginNames,

  pluginNameToPlugin = defaultPluginNameToPlugin,
  pluginNameToOptions = () => {},
}) => {
  return getCompatGroupMap({
    configLocation,
    stats,
    compatMap,
    size,
    platformNames,
    moduleOutput,
    pluginNames,
  }).then((compatGroupMap) => {
    return {
      clientVariables: {
        SERVER_COMPAT_MAP: compatGroupMapToClientCompatGroupMap(compatGroupMap),
        SERVER_COMPAT_MAP_DEFAULT_ID: DEFAULT_ID,
      },
      compileIdToCompileParams: createCompileIdToParam(
        compatGroupMap,
        pluginNameToPlugin,
        pluginNameToOptions,
      ),
    }
  })
}
