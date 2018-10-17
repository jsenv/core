/* eslint-disable import/max-dependencies */
import { compileFile } from "./compileFile.js"

export const compileToCompileFile = (
  compile,
  {
    root,
    cacheFolder = "build",
    compileFolder = "compiled",
    cacheIgnore = false,
    cacheTrackHit = false,
    locate = (file, root) => `${root}/${file}`,
  },
) => {
  return ({ file, eTag, ...rest }) => {
    return compileFile({
      compile,
      locate,
      root,
      cacheFolder,
      compileFolder,
      file,
      cacheIgnore,
      cacheTrackHit,
      inputETagClient: eTag,
      ...rest,
    })
  }
}
