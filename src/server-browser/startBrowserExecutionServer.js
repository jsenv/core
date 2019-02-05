import { patternGroupToMetaMap, forEachRessourceMatching } from "@dmail/project-structure"
import { startBrowserServer } from "./startBrowserServer.js"

export const startBrowserExecutionServer = async ({
  executablePatternMapping,
  localRoot,
  compileInto,
  compileGroupCount,
  pluginMap,
  pluginCompatMap,
  platformUsageMap,
  localCacheStrategy,
  localCacheTrackHit,
  cacheStrategy,
  sourceCacheStrategy,
  sourceCacheIgnore,
  preventCors,
  protocol,
  ip,
  port,
  forcePort,
  signature,
  generateHTML,
}) => {
  const metaMap = patternGroupToMetaMap({
    executable: executablePatternMapping,
  })

  const executableFiles = await forEachRessourceMatching({
    localRoot,
    metaMap,
    predicate: ({ executable }) => executable === true,
  })

  return startBrowserServer({
    localRoot,
    compileInto,
    compileGroupCount,
    pluginMap,
    pluginCompatMap,
    platformUsageMap,
    localCacheStrategy,
    localCacheTrackHit,
    cacheStrategy,
    sourceCacheStrategy,
    sourceCacheIgnore,
    preventCors,
    protocol,
    ip,
    port,
    forcePort,
    signature,
    executableFiles,
    generateHTML,
  })
}
