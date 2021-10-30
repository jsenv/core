import { collectFiles } from "@jsenv/filesystem"

import { generateFileExecutionSteps } from "./generateFileExecutionSteps.js"

export const generateExecutionSteps = async (
  plan,
  { abortSignal, projectDirectoryUrl },
) => {
  const structuredMetaMap = {
    filePlan: plan,
  }

  const fileResultArray = await collectFiles({
    abortSignal,
    directoryUrl: projectDirectoryUrl,
    structuredMetaMap,
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
