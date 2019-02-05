import { startCompileServer } from "../server-compile/index.js"
import { patternGroupToMetaMap, forEachRessourceMatching } from "@dmail/project-structure"

export const patternMappingToExecutionPlan = async ({
  cancellationToken,
  localRoot,
  compileInto,
  pluginMap,
  patternMapping,
}) => {
  const { origin: remoteRoot } = await startCompileServer({
    cancellationToken,
    localRoot,
    compileInto,
    pluginMap,
  })

  const metaMap = patternGroupToMetaMap({
    execute: patternMapping,
  })

  const executionPlan = {}
  await forEachRessourceMatching({
    cancellationToken,
    localRoot,
    metaMap,
    predicate: ({ test }) => test,
    callback: ({ ressource, meta }) => {
      const fileExecutionPlan = {}
      Object.keys(meta.test).forEach((platformName) => {
        const platformExecutionPlan = meta.test[platformName]
        const { launch, allocatedMs } = platformExecutionPlan
        fileExecutionPlan[platformName] = {
          launch: () =>
            launch({
              cancellationToken,
              localRoot,
              remoteRoot,
              compileInto,
            }),
          allocatedMs,
        }
      })

      executionPlan[ressource] = fileExecutionPlan
    },
  })
  return executionPlan
}
