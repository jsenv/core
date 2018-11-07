import { platformsToResultMap } from "./platformsToResultMap.js"

const testDescriptionToPlatforms = (
  testDescription,
  { localRoot, compileInto, remoteRoot, groupMapFile, watch },
) => {
  return Object.keys(testDescription).map((platformName) => {
    const { createExecute, files } = testDescription[platformName]

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

export const testDescriptionToPlatformResultMap = (
  testDescription,
  { cancellation, localRoot, compileInto, remoteRoot, groupMapFile, watch },
) => {
  const platforms = testDescriptionToPlatforms(testDescription, {
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
