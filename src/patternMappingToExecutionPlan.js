import { patternGroupToMetaMap, forEachRessourceMatching } from "@dmail/project-structure"
import { startCompileServer } from "./server-compile/index.js"

export const patternMappingToExecutionPlan = async ({
  cancellationToken,
  localRoot,
  compileInto,
  pluginMap,
  patternMapping,
  verbose = false,
}) => {
  const { origin: remoteRoot } = await startCompileServer({
    cancellationToken,
    localRoot,
    compileInto,
    pluginMap,
    verbose,
  })

  const metaMap = patternGroupToMetaMap({
    execute: patternMapping,
  })

  const executionPlan = {}
  await forEachRessourceMatching({
    cancellationToken,
    localRoot,
    metaMap,
    predicate: ({ execute }) => execute,
    callback: (ressource, meta) => {
      const executionMeta = meta.execute
      const fileExecutionPlan = {}
      Object.keys(executionMeta).forEach((platformName) => {
        const platformExecutionPlan = executionMeta[platformName]
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
