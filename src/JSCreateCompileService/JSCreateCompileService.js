import { compileFileToService } from "./compileFileToService/index.js"
import { compileToCompileFile } from "../compileToCompileFile/index.js"
import { compile, createInstrumentPlugin } from "./compile/index.js"
import { locate } from "./locate.js"

export const jsCreateCompileService = ({
  // compileFile options
  localRoot,
  compileInto,
  // compileFileToService options
  compileParamMap,
  cacheIgnore,
  cacheTrackHit,
  assetCacheIgnore,
  assetCacheStrategy,
  instrumentPredicate,
}) => {
  const compileFile = compileToCompileFile(compile, { localRoot, compileInto, locate })

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

  return service
}
