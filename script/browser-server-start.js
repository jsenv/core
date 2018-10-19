const {
  openBrowserServer,
  createPredicateFromStructure,
  jsCreateCompileService,
  jsCreateCompileHooks,
} = require("../dist/index.js")
const path = require("path")

const root = path.resolve(__dirname, "../")
const into = "build"
const watch = true

createPredicateFromStructure({ root }).then(({ instrumentPredicate, watchPredicate }) => {
  return jsCreateCompileHooks({
    configLocation: `${root}/${into}/compatGroupMap.config.json`,
  }).then(({ compileIdToCompileParams, getCompileIdSource }) => {
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

    return openBrowserServer({
      root,
      into,
      watch,
      watchPredicate,
      compileService: jsCompileService,
      getCompileIdSource,
    })
  })
})
