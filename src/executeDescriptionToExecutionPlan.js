import {
  namedValueDescriptionToMetaDescription,
  selectAllFileInsideFolder,
} from "@dmail/project-structure"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { startCompileServer } from "./compile-server/index.js"

export const executeDescriptionToExecutionPlan = async ({
  cancellationToken,
  projectPathname,
  compileIntoRelativePath,
  importMapRelativePath,
  browserGroupResolverRelativePath,
  nodeGroupResolverRelativePath,
  compileGroupCount,
  babelPluginMap,
  executeDescription,
  defaultAllocatedMsPerExecution = 20000,
  compileServerLogLevel,
}) => {
  const projectPath = pathnameToOperatingSystemPath(projectPathname)

  const { origin: compileServerOrigin } = await startCompileServer({
    cancellationToken,
    projectPath,
    compileIntoRelativePath,
    importMapRelativePath,
    browserGroupResolverRelativePath,
    nodeGroupResolverRelativePath,
    compileGroupCount,
    babelPluginMap,
    logLevel: compileServerLogLevel,
  })

  const metaDescription = namedValueDescriptionToMetaDescription({
    execute: executeDescription,
  })

  const executionPlan = {}
  await selectAllFileInsideFolder({
    cancellationToken,
    pathname: projectPathname,
    metaDescription,
    predicate: ({ execute }) => execute,
    transformFile: ({ filenameRelative, meta }) => {
      const fileRelativePath = `/${filenameRelative}`
      const executionMeta = meta.execute
      const fileExecutionPlan = {}
      Object.keys(executionMeta).forEach((executionName) => {
        const singleExecutionPlan = executionMeta[executionName]
        if (singleExecutionPlan === null || singleExecutionPlan === undefined) return
        if (typeof singleExecutionPlan !== "object") {
          throw new TypeError(`a single execution must be an object.
          fileRelativePath: ${fileRelativePath}
executionName: ${executionName}
singleExecutionPlan: ${singleExecutionPlan}`)
        }

        const { launch, allocatedMs } = singleExecutionPlan
        fileExecutionPlan[executionName] = {
          launch: (options) =>
            launch({
              ...options,
              cancellationToken,
              compileServerOrigin,
              projectPath,
              compileIntoRelativePath,
            }),
          allocatedMs: allocatedMs === undefined ? defaultAllocatedMsPerExecution : allocatedMs,
        }
      })

      executionPlan[fileRelativePath] = fileExecutionPlan
    },
  })
  return executionPlan
}
