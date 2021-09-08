import { resolveUrl, normalizeStructuredMetaMap, urlToMeta } from "@jsenv/filesystem"

import { generateFileExecutionSteps } from "@jsenv/core/src/internal/executing/generateFileExecutionSteps.js"

export const relativeUrlToExecutionSteps = (relativeUrl, { projectDirectoryUrl, plan }) => {
  const structuredMetaMapForExecution = normalizeStructuredMetaMap(
    {
      filePlan: plan,
    },
    projectDirectoryUrl,
  )

  const meta = urlToMeta({
    url: resolveUrl(relativeUrl, projectDirectoryUrl),
    structuredMetaMap: structuredMetaMapForExecution,
  })
  if (meta.filePlan) {
    return generateFileExecutionSteps({
      fileRelativeUrl: relativeUrl,
      filePlan: meta.filePlan,
    })
  }

  return []
}
