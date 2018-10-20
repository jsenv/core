import { compileFileToService } from "./compileFileToService/index.js"
import { compileToCompileFile } from "../compileToCompileFile/index.js"
import { compile } from "./compile/index.js"
import { locate } from "./locate.js"

export const jsCreateCompileService = ({
  // compileFile options
  root,
  into,
  // compileFileToService options
  compileIdToCompileParams,
  cacheIgnore,
  cacheTrackHit,
  assetCacheIgnore,
  assetCacheStrategy,
}) => {
  const compileFile = compileToCompileFile(compile, { root, into, locate })

  const service = compileFileToService(compileFile, {
    root,
    into,
    compileIdToCompileParams,
    cacheIgnore,
    cacheTrackHit,
    assetCacheIgnore,
    assetCacheStrategy,
  })

  return service
}
