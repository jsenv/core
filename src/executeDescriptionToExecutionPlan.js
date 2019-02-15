import { filenameToFileHref } from "@jsenv/module-resolution"
import {
  namedValueDescriptionToMetaDescription,
  selectAllFileInsideFolder,
} from "@dmail/project-structure"
import { startCompileServer } from "./server-compile/index.js"

export const executeDescriptionToExecutionPlan = async ({
  cancellationToken,
  projectFolder,
  compileInto,
  babelPluginDescription,
  executeDescription,
  verbose = false,
}) => {
  const sourceOrigin = filenameToFileHref(projectFolder)

  const { origin: compileServerOrigin } = await startCompileServer({
    cancellationToken,
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
      Object.keys(executionMeta).forEach((platformName) => {
        const platformExecutionPlan = executionMeta[platformName]
        const { launch, allocatedMs } = platformExecutionPlan
        fileExecutionPlan[platformName] = {
          launch: (options) =>
            launch({
              ...options,
              cancellationToken,
              compileInto,
              sourceOrigin,
              compileServerOrigin,
            }),
          allocatedMs,
        }
      })

      executionPlan[filenameRelative] = fileExecutionPlan
    },
  })
  return executionPlan
}
