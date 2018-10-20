const {
  createPredicateFromStructure,
  jsCreateCompileService,
  jsCreateCompileHooks,
} = require("../dist/index.js")
const { isPluginNameCore, pluginNameToPlugin } = require("@dmail/project-structure-compile-babel")

const into = "build"
const pluginMap = {}
const pluginOptionMap = {
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
  "transform-modules-systemjs": {},
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
}
Object.keys(pluginOptionMap).forEach((pluginName) => {
  if (isPluginNameCore) {
    pluginMap[name] = [pluginNameToPlugin(pluginName), pluginOptionMap[pluginName]]
  }
  throw new Error(`unknown plugin ${pluginName}`)
})

export const createJSCompileServiceForProject = ({ root }) => {
  return createPredicateFromStructure({ root }).then(({ instrumentPredicate, watchPredicate }) => {
    return jsCreateCompileHooks({
      configLocation: `${root}/${into}/compatGroupMap.config.json`,
      // stats,
      // compatMap,
      // size,
      // platformNames,
      pluginMap,
    }).then(({ compileIdToCompileParams, VARS }) => {
      const jsCompileService = jsCreateCompileService({
        root,
        into,
        compileIdToCompileParams,
        cacheIgnore: false,
        cacheTrackHit: true,
        cacheStrategy: "etag",
        assetCacheIgnore: false,
        assetCacheStrategy: "etag",
        instrumentPredicate,
      })

      return {
        watchPredicate,
        jsCompileService,
        LOCAL_ROOT: root,
        COMPILE_INTO: into,
        VARS,
      }
    })
  })
}
