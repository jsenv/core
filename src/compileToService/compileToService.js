import { createCacheRequestToResponse } from "./createCacheRequestToResponse.js"
import { createCompileRequestToResponse } from "./createCompileRequestToResponse.js"
import { serviceCompose } from "../openServer/index.js"
import { compileToCompileFile } from "./compileToCompileFile.js"

export const compileToService = (
  compile,
  {
    root,
    cacheFolder,
    compileFolder,
    cacheIgnore = false,
    cacheTrackHit = false,
    cacheStrategy = "mtime",
  },
) => {
  const compileFile = compileToCompileFile(compile, {
    root,
    cacheFolder,
    compileFolder,
    cacheIgnore,
    cacheTrackHit,
  })

  const cacheRequestToResponse = createCacheRequestToResponse({
    root,
    cacheFolder,
    cacheIgnore,
    cacheStrategy,
  })

  const compileRequestToResponse = createCompileRequestToResponse({ compileFile, compileFolder })

  return serviceCompose(cacheRequestToResponse, compileRequestToResponse)
}
