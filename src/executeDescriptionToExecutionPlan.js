import { namedValueDescriptionToMetaDescription } from "@dmail/project-structure"
import { matchAllFileInsideFolder } from "@dmail/filesystem-matching"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { startCompileServer } from "./compile-server/index.js"
import { sortPathnameArray } from "./sort-pathname-array.js"

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
  compileServerLogLevel,
  cover = false,
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
  await matchAllFileInsideFolder({
    cancellationToken,
    folderPath: projectPathname,
    metaDescription,
    predicate: ({ execute }) => execute,
    matchingFileOperation: ({ relativePath, meta }) => {
      const executionMeta = meta.execute
      const fileExecutionPlan = {}
      Object.keys(executionMeta).forEach((executionName) => {
        const singleExecutionPlan = executionMeta[executionName]
        if (singleExecutionPlan === null || singleExecutionPlan === undefined) return
        if (typeof singleExecutionPlan !== "object") {
          throw new TypeError(`a single execution must be an object.
          fileRelativePath: ${relativePath}
executionName: ${executionName}
singleExecutionPlan: ${singleExecutionPlan}`)
        }

        const { launch, allocatedMs } = singleExecutionPlan
        fileExecutionPlan[executionName] = {
          launch: (options) =>
            launch({
              compileServerOrigin,
              projectPath,
              compileIntoRelativePath,
              babelPluginMap,
              cover,
              ...options,
            }),
          allocatedMs,
        }
      })

      executionPlan[relativePath] = fileExecutionPlan
    },
  })
  return sortExecutionPlan(executionPlan)
}

const sortExecutionPlan = (executionPlan) => {
  const sortedExecutionPlan = {}
  sortPathnameArray(Object.keys(executionPlan)).forEach((key) => {
    sortedExecutionPlan[key] = executionPlan[key]
  })
  return sortedExecutionPlan
}
