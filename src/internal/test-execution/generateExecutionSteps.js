import { metaMapToSpecifierMetaMap } from "@jsenv/url-meta"
import { collectFiles } from "@jsenv/file-collector"
import { pathToFileUrl } from "../urlUtils.js"
import { generateFileExecutionSteps } from "./generateFileExecutionSteps.js"

export const generateExecutionSteps = async (plan, { cancellationToken, projectDirectoryUrl }) => {
  const specifierMetaMap = metaMapToSpecifierMetaMap({
    filePlan: plan,
  })

  const fileResultArray = await collectFiles({
    cancellationToken,
    directoryPath: pathToFileUrl(projectDirectoryUrl),
    specifierMetaMap,
    predicate: ({ filePlan }) => filePlan,
  })

  const executionSteps = []
  fileResultArray.forEach(({ relativePath, meta }) => {
    const fileExecutionSteps = generateFileExecutionSteps({
      fileRelativePath: relativePath,
      filePlan: meta.filePlan,
    })
    executionSteps.push(...fileExecutionSteps)
  })
  return executionSteps
}
