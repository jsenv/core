import { compileFileToService } from "./compileFileToService/index.js"
import { compileToCompileFile } from "../compileToCompileFile/index.js"
import { compile } from "./compile/index.js"
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
}) => {
  const compileFile = compileToCompileFile(compile, { localRoot, compileInto, locate })

  const service = compileFileToService(compileFile, {
    localRoot,
    compileInto,
    compileParamMap,
    cacheIgnore,
    cacheTrackHit,
    assetCacheIgnore,
    assetCacheStrategy,
  })

  return service
}
