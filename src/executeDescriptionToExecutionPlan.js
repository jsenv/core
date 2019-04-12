import {
  namedValueDescriptionToMetaDescription,
  selectAllFileInsideFolder,
} from "@dmail/project-structure"
import { startCompileServer } from "./server-compile/index.js"

export const executeDescriptionToExecutionPlan = async ({
  cancellationToken,
  importMapFilenameRelative,
  projectFolder,
  compileInto,
  compileGroupCount,
  babelConfigMap,
  executeDescription,
  verbose = false,
  defaultAllocatedMsPerExecution = 20000,
  enableGlobalLock,
}) => {
  const sourceOrigin = `file://${projectFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    cancellationToken,
    importMapFilenameRelative,
    projectFolder,
    compileInto,
    compileGroupCount,
    babelConfigMap,
    verbose,
    enableGlobalLock,
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
        const singleExecutionPlan = executionMeta[executionName]
        if (singleExecutionPlan === null || singleExecutionPlan === undefined) return
        if (typeof singleExecutionPlan !== "object") {
          throw new TypeError(`a single execution must be an object.
file: ${filenameRelative}
executionName: ${executionName}
singleExecutionPlan: ${singleExecutionPlan}`)
        }

        const { launch, allocatedMs } = singleExecutionPlan
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
