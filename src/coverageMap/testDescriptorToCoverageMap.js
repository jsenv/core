import { testDescriptorToPlatformResultMap } from "./testDescriptorToPlatformResultMap.js"
import { platformCoverageMapToCoverageMap } from "./platformCoverageMapToCoverageMap.js"
import { platformResultMapToCoverageMap } from "./platformResultMapToCoverageMap.js"

export const testDescriptorToCoverageMap = async (
  testDescriptor,
  { cancellation, localRoot, compileInto, remoteRoot, groupMapFile, watch, filesToCover },
) => {
  const platformResultMap = await testDescriptorToPlatformResultMap(testDescriptor, {
    cancellation,
    localRoot,
    compileInto,
    remoteRoot,
    groupMapFile,
    watch,
  })

  const platformCoverageMap = platformResultMapToCoverageMap(platformResultMap)

  const coverageMap = await platformCoverageMapToCoverageMap(platformCoverageMap, {
    cancellation,
    localRoot,
    filesToCover,
  })

  return coverageMap
}
