import { createCompile } from "./createCompile/index.js"
import { compileToService } from "./compileToService/index.js"
import { createCompileProfiles } from "./createCompileProfiles/index.js"

export const jsCreateCompileService = ({
  // compile options
  instrument,
  instrumentPredicate,
  // compileFile options
  root,
  cacheFolder,
  compileFolder,
  cacheIgnore,
  cacheTrackHit,
  cacheStrategy,
}) => {
  const compile = createCompile({ instrument, instrumentPredicate })

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
