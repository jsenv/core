import { resolveUrl, normalizeStructuredMetaMap, urlToMeta } from "@jsenv/util"
import { generateFileExecutionSteps } from "../../executing/generateFileExecutionSteps.js"

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
