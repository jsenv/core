import { compileToService } from "../compileToService/index.js"
import { createInstrumentPlugin } from "../jsCompile/index.js"
import { locate } from "./locate.js"

export const jsCompileToService = (
  compileFile,
  {
    cancellation,
    localRoot,
    compileInto,
    compileParamMap = {},
    localCacheStrategy = "etag",
    localCacheTrackHit = true,
    cacheStrategy = "etag",
    assetCacheStrategy = "eTag",
    instrumentPredicate = () => true,
    watch,
    watchPredicate,
  },
) => {
  const instrumentPlugin = createInstrumentPlugin({ predicate: instrumentPredicate })
  const compileParamMapWithInstrumentation = { ...compileParamMap }
  Object.keys(compileParamMap).forEach((groupId) => {
    const param = compileParamMap[groupId]
    compileParamMapWithInstrumentation[`${groupId}-instrumented`] = {
      ...param,
      plugins: [...param.plugins, instrumentPlugin],
    }
  })

  const service = compileToService(compileFile, {
    cancellation,
    localRoot,
    compileInto,
    locate,
    compileParamMap: compileParamMapWithInstrumentation,
    localCacheStrategy,
    localCacheTrackHit,
    cacheStrategy,
    assetCacheStrategy,
    watch,
    watchPredicate,
  })

  const jsService = (request) => {
    return service(request).catch((error) => {
      if (error && error.name === "PARSE_ERROR") {
        const json = JSON.stringify(error)

        return {
          status: 500,
          reason: "parse error",
          headers: {
            "cache-control": "no-store",
            "content-length": Buffer.byteLength(json),
            "content-type": "application/json",
          },
          body: json,
        }
      }
      return Promise.reject(error)
    })
  }

  return jsService
}
