import { readProjectMetaMap, ressourceToMeta } from "@dmail/project-structure"
import { jsCompile } from "./jsCompile/index.js"
import { jsCompileToCompileFile } from "./jsCompileToCompileFile/index.js"
import { jsCompileFileToService } from "./jsCompileFileToService/index.js"
import { getGroupMap, groupMapToCompileParamMap } from "./groupMap/index.js"
import {
  pluginOptionMapToPluginMap,
  fileWriteFromString,
} from "@dmail/project-structure-compile-babel"
import { readFile } from "./fileHelper.js"
import { objectToPromiseAll } from "./promiseHelper.js"
import {
  compilePlatformAndSystem,
  getBrowserSystemLocalURL,
  getBrowserPlatformLocalURL,
} from "./compilePlatformAndSystem.js"
import { predicateCompose } from "./functionHelper.js"

const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},

  "proposal-async-generator-functions": {},
  "proposal-json-strings": {},
  "proposal-object-rest-spread": {},
  "proposal-optional-catch-binding": {},
  "proposal-unicode-property-regex": {},
  "transform-arrow-functions": {},
  "transform-async-to-generator": {},
  "transform-block-scoped-functions": {},
  "transform-block-scoping": {},
  "transform-classes": {},
  "transform-computed-properties": {},
  "transform-destructuring": {},
  "transform-dotall-regex": {},
  "transform-duplicate-keys": {},
  "transform-exponentiation-operator": {},
  "transform-for-of": {},
  "transform-function-name": {},
  "transform-literals": {},
  "transform-new-target": {},
  "transform-object-super": {},
  "transform-parameters": {},
  "transform-regenerator": {},
  "transform-shorthand-properties": {},
  "transform-spread": {},
  "transform-sticky-regex": {},
  "transform-template-literals": {},
  "transform-typeof-symbol": {},
  "transform-unicode-regex": {},
})

const getGroupMapForProject = (config) => {
  return readFile(config).then(
    (content) => JSON.parse(content),
    (error) => {
      if (error && error.code === "ENOENT") {
        const groupMap = getGroupMap({ pluginNames: Object.keys(pluginMap) })

        fileWriteFromString(config, JSON.stringify(groupMap, null, "  "))

        return groupMap
      }
      return Promise.reject(error)
    },
  )
}

export const jsCreateCompileServiceForProject = async ({
  localRoot,
  compileInto,
  instrumentPredicate = () => true,
}) => {
  const groupMapFile = "groupMap.json"
  const groupMapLocation = `${localRoot}/${compileInto}/${groupMapFile}`

  const { projectMetaMap, groupMap } = await objectToPromiseAll({
    // we should not have to compile thoose static files
    // we would just have to move them to compileInto/
    platformAndSystem: compilePlatformAndSystem({
      browserSystemLocalURL: getBrowserSystemLocalURL({ localRoot, compileInto }),
      browserPlatformLocalURL: getBrowserPlatformLocalURL({ localRoot, compileInto }),
    }),
    projectMetaMap: readProjectMetaMap({ root: localRoot }),
    groupMap: getGroupMapForProject(groupMapLocation),
  })

  instrumentPredicate = predicateCompose(instrumentPredicate, (file) => {
    return Boolean(ressourceToMeta(projectMetaMap, file).cover)
  })

  const watchPredicate = (file) => {
    return Boolean(ressourceToMeta(projectMetaMap, file).watch)
  }

  const compileParamMap = groupMapToCompileParamMap(groupMap, pluginMap)
  const jsCompileFile = jsCompileToCompileFile(jsCompile)
  const jsCompileService = jsCompileFileToService(jsCompileFile, {
    compileParamMap,
    cacheIgnore: false,
    cacheTrackHit: true,
    cacheStrategy: "etag",
    assetCacheIgnore: false,
    assetCacheStrategy: "etag",
    instrumentPredicate,
  })

  return {
    compileService: jsCompileService,
    groupMap,
    groupMapFile,
    watchPredicate,
    projectMetaMap,
  }
}
