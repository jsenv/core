import { createCompile } from "./createCompile/index.js"
import { compileToService } from "./compileToService/index.js"
import { createCompileProfiles } from "./createCompileProfiles/index.js"

export const JSCreateCompileService = ({
  // compile options
  createOptions,
  instrumentPredicate,
  // compileFile options
  root,
  cacheFolder,
  compileFolder,
  cacheIgnore,
  cacheTrackHit,
  cacheStrategy,
}) => {
  const compile = createCompile({ createOptions, instrumentPredicate })

  const { getGroupIdAndPluginsForPlatform } = createCompileProfiles({
    root,
    into: "group.config.json",
  })

  const service = compileToService(compile, {
    root,
    cacheFolder,
    compileFolder,
    cacheIgnore,
    cacheTrackHit,
    cacheStrategy,
    getGroupIdAndPluginsForPlatform,
  })

  return service
}
