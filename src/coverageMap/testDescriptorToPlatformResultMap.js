import { platformsToResultMap } from "./platformsToResultMap.js"

const testDescriptorToPlatforms = (
  testDescriptor,
  { localRoot, compileInto, remoteRoot, groupMapFile, watch },
) => {
  return Object.keys(testDescriptor).map((platformName) => {
    const { createExecute, files } = testDescriptor[platformName]

    return {
      name: platformName,
      execute: createExecute({
        localRoot,
        remoteRoot,
        compileInto,
        groupMapFile,
        hotreload: watch,
        hotreloadSSERoot: remoteRoot,
      }),
      files,
    }
  })
}

export const testDescriptorToPlatformResultMap = (
  testDescriptor,
  { cancellation, localRoot, compileInto, remoteRoot, groupMapFile, watch },
) => {
  const platforms = testDescriptorToPlatforms(testDescriptor, {
    localRoot,
    compileInto,
    remoteRoot,
    groupMapFile,
    watch,
  })

  return platformsToResultMap({
    cancellation,
    platforms,
  })
}

// filesToCover will come from projectMetaMap because to painful to maintain
// and I think we can assume the default behaviour is that every file should be covered except test files
// const filesToCover = await forEachRessourceMatching(
// 	localRoot,
// 	projectMetaMap,
// 	({ cover }) => cover,
// 	({ relativeName }) => relativeName,
// )

// import { forEachRessourceMatching } from "@dmail/project-structure"
