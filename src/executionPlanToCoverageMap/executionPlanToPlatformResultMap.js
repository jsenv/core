import { platformsToResultMap } from "./platformsToResultMap.js"

export const executionPlanToPlatformResultMap = (
  executionPlan,
  { cancellationToken, localRoot, compileInto, remoteRoot, watch },
) => {
  const platforms = executionPlanToPlatforms(executionPlan, {
    localRoot,
    compileInto,
    remoteRoot,
    watch,
  })

  return platformsToResultMap({
    cancellationToken,
    platforms,
  })
}

const executionPlanToPlatforms = (executionPlan, { localRoot, compileInto, remoteRoot, watch }) => {
  return Object.keys(executionPlan).map((platformName) => {
    const { createExecute, files } = executionPlan[platformName]

    return {
      name: platformName,
      // todo: this is not createExecute anymore but sthing like launchPlatform
      execute: createExecute({
        localRoot,
        remoteRoot,
        compileInto,
        hotreload: watch,
        hotreloadSSERoot: remoteRoot,
      }),
      files,
    }
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
