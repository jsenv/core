/* eslint-disable import/max-dependencies */
import { compileFile } from "./compileFile.js"

export const compileToCompileFile = (
  compile,
  { root, into, locate = (file, root) => `${root}/${file}` },
) => {
  return ({
    compileId,
    compileParamMap,
    file,
    eTag,
    cacheIgnore = false,
    cacheTrackHit = false,
  }) => {
    return compileFile({
      compile,
      root,
      into,
      locate,
      compileId,
      compileParamMap,
      file,
      eTag,
      cacheIgnore,
      cacheTrackHit,
    })
  }
}
