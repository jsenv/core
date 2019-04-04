import { startCompileServer } from "./server-compile/index.js"

const { namedValueDescriptionToMetaDescription, selectAllFileInsideFolder } = import.meta.require(
  "@dmail/project-structure",
)

export const executeDescriptionToExecutionPlan = async ({
  cancellationToken,
  importMap,
  projectFolder,
  compileInto,
  compileGroupCount,
  babelConfigMap,
  executeDescription,
  verbose = false,
  defaultAllocatedMsPerExecution = 20000,
}) => {
  const sourceOrigin = `file://${projectFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    cancellationToken,
    importMap,
    projectFolder,
    compileInto,
    compileGroupCount,
    babelConfigMap,
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
