import { compileFileToService } from "../compileFileToService/index.js"
import { createInstrumentPlugin } from "../jsCompile/index.js"

export const jsCompileFileToService = (
  compileFile,
  {
    localRoot,
    compileInto,
    compileParamMap,
    cacheIgnore,
    cacheTrackHit,
    assetCacheIgnore,
    assetCacheStrategy,
    instrumentPredicate,
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

  const service = compileFileToService(compileFile, {
    localRoot,
    compileInto,
    compileParamMap: compileParamMapWithInstrumentation,
    cacheIgnore,
    cacheTrackHit,
    assetCacheIgnore,
    assetCacheStrategy,
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
