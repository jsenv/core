import { createCancellationToken } from "@dmail/cancellation"
import { fileWriteFromString } from "@dmail/project-structure-compile-babel"
import { objectMapValue } from "../objectHelper.js"
import { jsCompile } from "../jsCompile/index.js"
import { jsCompileToService } from "../jsCompileToService/index.js"
import { envDescriptionToCompileMap } from "./envDescriptionToCompileMap/index.js"

export const createJsCompileService = async ({
  cancellationToken = createCancellationToken(),
  localRoot,
  compileInto,
  locate,
  compileGroupCount,
  pluginMap,
  pluginCompatMap,
  platformUsageMap,
  localCacheStrategy,
  localCacheTrackHit,
  cacheStrategy,
  instrumentPredicate,
  watch,
  watchPredicate,
}) => {
  const compileMap = generateCompileMap({
    pluginMap,
    platformUsageMap,
    pluginCompatMap,
    compileGroupCount,
  })

  await fileWriteFromString(
    `${localRoot}/${compileInto}/compileMap.json`,
    JSON.stringify(compileMap, null, "  "),
  )

  const compileParamMap = compileMapToCompileParamMap(compileMap, pluginMap)

  const jsCompileService = jsCompileToService(jsCompile, {
    cancellationToken,
    localRoot,
    compileInto,
    locate,
    compileParamMap,
    localCacheStrategy,
    localCacheTrackHit,
    cacheStrategy,
    instrumentPredicate,
    watch,
    watchPredicate,
  })

  return jsCompileService
}

export const generateCompileMap = ({
  pluginMap,
  platformUsageMap,
  pluginCompatMap,
  compileGroupCount,
}) => {
  if (!pluginMap) throw new Error(`pluginMap is required`)

  const compileMap = envDescriptionToCompileMap({
    pluginNames: Object.keys(pluginMap),
    platformUsageMap,
    pluginCompatMap,
    compileGroupCount,
  })

  return compileMap
}

export const compileMapToCompileParamMap = (compileMap, pluginMap = {}) => {
  return objectMapValue(compileMap, ({ pluginNames }) => {
    const pluginMapSubset = {}
    pluginNames.forEach((pluginName) => {
      if (pluginName in pluginMap === false) {
        throw new Error(`missing ${pluginName} plugin in pluginMap`)
      }
      pluginMapSubset[pluginName] = pluginMap[pluginName]
    })
    return {
      pluginMap: pluginMapSubset,
    }
  })
}
