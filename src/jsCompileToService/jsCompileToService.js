import { compileToService } from "../compileToService/index.js"
import { createInstrumentPlugin } from "../jsCompile/index.js"
import { ansiToHTML } from "../ansiToHTML.js"

export const jsCompileToService = (
  compileFile,
  {
    cancellationToken,
    localRoot,
    compileInto,
    locate,
    compileParamMap = {},
    localCacheStrategy = "etag",
    localCacheTrackHit = true,
    cacheStrategy = "etag",
    instrumentPredicate = () => true,
    compilePredicate = () => true,
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
      pluginMap: {
        ...param.pluginMap,
        "transform-instrument": instrumentPlugin,
      },
    }
  })

  const service = compileToService(compileFile, {
    cancellationToken,
    localRoot,
    compileInto,
    locate,
    compileParamMap: compileParamMapWithInstrumentation,
    localCacheStrategy,
    localCacheTrackHit,
    cacheStrategy,
    compilePredicate: (file, fileAbsolute) => {
      if (fileAbsolute === `browserPlatform.js`) return false
      if (fileAbsolute === `browserSystemImporter.js`) return false
      return compilePredicate(file, fileAbsolute)
    },
    watch,
    watchPredicate,
  })

  const jsService = async (request) => {
    try {
      const response = await service(request)
      return response
    } catch (e) {
      if (e && e.name === "PARSE_ERROR") {
        e.messageHTML = ansiToHTML(e.message)
        const json = JSON.stringify(e)

        return {
          status: 500,
          statusText: "parse error",
          headers: {
            "cache-control": "no-store",
            "content-length": Buffer.byteLength(json),
            "content-type": "application/json",
          },
          body: json,
        }
      }
      throw e
    }
  }

  return jsService
}
