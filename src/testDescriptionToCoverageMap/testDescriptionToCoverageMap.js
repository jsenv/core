import { projectConfigToJsCompileService } from "../createJsCompileService.js"
import { open as serverCompileOpen } from "../server-compile/index.js"
import { predicateCompose } from "../functionHelper.js"
import { testDescriptionToPlatformResultMap } from "./testDescriptionToPlatformResultMap.js"
import { platformCoverageMapToCoverageMap } from "./platformCoverageMapToCoverageMap.js"
import { platformResultMapToCoverageMap } from "./platformResultMapToCoverageMap.js"

const testDescriptionToIsTestFile = (testDescription) => {
  const testFiles = new Set()

  Object.keys(testDescription).forEach((name) => {
    testDescription[name].files.forEach((file) => {
      testFiles.add(file)
    })
  })

  return (file) => testFiles.has(file)
}

export const testDescriptionToCoverageMap = async (
  testDescription,
  {
    localRoot,
    compileInto,
    pluginMap,
    compileMap,
    instrumentPredicate,
    cacheIgnore,
    cacheTrackHit,
    cacheStrategy,
    assetCacheIgnore,
    assetCacheStrategy,
    watchPredicate = () => true,
    listFilesToCover = () => [],
  },
  { cancellation, watch = false },
) => {
  const isTestFile = testDescriptionToIsTestFile(testDescription)
  const jsCompileService = await projectConfigToJsCompileService({
    localRoot,
    compileInto,
    pluginMap,
    compileMap,
    instrumentPredicate: predicateCompose(
      instrumentPredicate,
      (file) => isTestFile(file) === false,
    ),
    cacheIgnore,
    cacheTrackHit,
    cacheStrategy,
    assetCacheIgnore,
    assetCacheStrategy,
  })

  const [server, filesToCover] = await Promise.all([
    serverCompileOpen({
      cancellation,
      protocol: "http",
      ip: "127.0.0.1",
      port: 0,
      localRoot,
      compileInto,
      compileService: jsCompileService,
      watchPredicate,
      watch,
    }),
    listFilesToCover(),
  ])

  const platformResultMap = await testDescriptionToPlatformResultMap(testDescription, {
    cancellation,
    localRoot,
    compileInto,
    remoteRoot: server.origin,
    watch,
  })

  const platformCoverageMap = platformResultMapToCoverageMap(platformResultMap)

  const coverageMap = await platformCoverageMapToCoverageMap(platformCoverageMap, {
    cancellation,
    localRoot,
    filesToCover: filesToCover.filter((file) => isTestFile(file) === false),
  })

  return coverageMap
}
