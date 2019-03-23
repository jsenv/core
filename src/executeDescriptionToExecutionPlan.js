import {
  namedValueDescriptionToMetaDescription,
  selectAllFileInsideFolder,
} from "@dmail/project-structure"
import { startCompileServer } from "./server-compile/index.js"

export const executeDescriptionToExecutionPlan = async ({
  cancellationToken,
  importMap,
  projectFolder,
  compileInto,
  babelPluginDescription,
  executeDescription,
  verbose = false,
  defaultAllocatedMsPerExecution = 10000,
}) => {
  const sourceOrigin = `file://${projectFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    cancellationToken,
    importMap,
    projectFolder,
    compileInto,
    babelPluginDescription,
    verbose,
  })

  const metaDescription = namedValueDescriptionToMetaDescription({
    execute: executeDescription,
  })

  const executionPlan = {}
  await selectAllFileInsideFolder({
    cancellationToken,
    pathname: projectFolder,
    metaDescription,
    predicate: ({ execute }) => execute,
    transformFile: ({ filenameRelative, meta }) => {
      const executionMeta = meta.execute
      const fileExecutionPlan = {}
      Object.keys(executionMeta).forEach((executionName) => {
        const platformExecutionPlan = executionMeta[executionName]
        const { launch, allocatedMs } = platformExecutionPlan
        fileExecutionPlan[executionName] = {
          launch: (options) =>
            launch({
              ...options,
              cancellationToken,
              compileInto,
              sourceOrigin,
              compileServerOrigin,
            }),
          allocatedMs: allocatedMs === undefined ? defaultAllocatedMsPerExecution : allocatedMs,
        }
      })

      executionPlan[filenameRelative] = fileExecutionPlan
    },
  })
  return executionPlan
}
