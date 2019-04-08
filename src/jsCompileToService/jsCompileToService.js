import { compileToService } from "../compileToService/index.js"

export const jsCompileToService = (
  compileFile,
  {
    cancellationToken,
    projectFolder,
    compileInto,
    locate,
    compileDescription = {},
    localCacheStrategy = "etag",
    localCacheTrackHit = true,
    cacheStrategy = "etag",
    compilePredicate = () => true,
    watch,
    watchPredicate,
  },
) => {
  const service = compileToService(compileFile, {
    cancellationToken,
    projectFolder,
    compileInto,
    locate,
    compileDescription,
    localCacheStrategy,
    localCacheTrackHit,
    cacheStrategy,
    compilePredicate: (filenameRelative, filename) => {
      if (filenameRelative.endsWith(".json")) return false
      // if (filenameRelative === `platform.js`) return false
      // if (filenameRelative === `importer.js`) return false
      return compilePredicate(filenameRelative, filename)
    },
    watch,
    watchPredicate,
  })

  return service
}
