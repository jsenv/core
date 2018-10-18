/* eslint-disable import/max-dependencies */
import { compileFile } from "./compileFile.js"

export const compileToCompileFile = (
  compile,
  { root, into, group, groupParams, locate = (file, root) => `${root}/${file}` },
) => {
  return ({ file, eTag, cacheIgnore = false, cacheTrackHit = false }) => {
    return compileFile({
      compile,
      root,
      into,
      group,
      groupParams,
      locate,
      cacheIgnore,
      cacheTrackHit,
      file,
      eTag,
    })
  }
}
