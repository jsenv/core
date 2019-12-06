import { metaMapToSpecifierMetaMap } from "@jsenv/url-meta"
import { collectFiles } from "@jsenv/file-collector"
import { filePathToUrl } from "internal/urlUtils.js"
import { generateFileExecutionSteps } from "./generateFileExecutionSteps.js"

export const generateExecutionSteps = async (plan, { cancellationToken, projectDirectoryUrl }) => {
  const specifierMetaMap = metaMapToSpecifierMetaMap({
    filePlan: plan,
  })

  const fileResultArray = await collectFiles({
    cancellationToken,
    directoryPath: filePathToUrl(projectDirectoryUrl),
    specifierMetaMap,
    predicate: ({ filePlan }) => filePlan,
  })

  const executionSteps = []
  fileResultArray.forEach(({ relativeUrl, meta }) => {
    const fileExecutionSteps = generateFileExecutionSteps({
      fileRelativeUrl: relativeUrl,
      filePlan: meta.filePlan,
    })
    executionSteps.push(...fileExecutionSteps)
  })
  return executionSteps
}
