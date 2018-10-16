import { createCacheRequestToResponse } from "./createCacheRequestToResponse.js"
import { createCompileRequestToResponse } from "./createCompileRequestToResponse.js"
import { serviceCompose } from "../../openServer/index.js"
import { compileToCompileFile } from "../../compileToService/index.js"
import { locate } from "./locate.js"

export const compileToService = (
  compile,
  {
    root,
    cacheFolder,
    compileFolder,
    cacheIgnore = false,
    cacheTrackHit = false,
    cacheStrategy = "mtime",
    getGroupIdAndPluginsForPlatform = () => ({
      id: "anonymous",
    }),
  },
) => {
  const compileFile = compileToCompileFile(compile, {
    root,
    cacheFolder,
    compileFolder,
    cacheIgnore,
    cacheTrackHit,
    locate,
  })

  const cacheRequestToResponse = createCacheRequestToResponse({
    root,
    cacheFolder,
    cacheIgnore,
    cacheStrategy,
  })

  const compileRequestToResponse = createCompileRequestToResponse({
    compileFile,
    compileFolder,
    getGroupIdAndPluginsForPlatform,
  })

  return serviceCompose(cacheRequestToResponse, compileRequestToResponse)
}
