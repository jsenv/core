import { metaMapToSpecifierMetaMap, normalizeSpecifierMetaMap, urlToMeta } from "@jsenv/url-meta"
import { resolveFileUrl } from "internal/urlUtils.js"
import { generateFileExecutionSteps } from "internal/executing/generateFileExecutionSteps.js"

export const relativeUrlToExecutionSteps = (relativeUrl, { projectDirectoryUrl, plan }) => {
  const specifierMetaMapForExecution = normalizeSpecifierMetaMap(
    metaMapToSpecifierMetaMap({
      filePlan: plan,
    }),
    projectDirectoryUrl,
  )

  const meta = urlToMeta({
    url: resolveFileUrl(relativeUrl, projectDirectoryUrl),
    specifierMetaMap: specifierMetaMapForExecution,
  })
  if (meta.filePlan) {
    return generateFileExecutionSteps({
      fileRelativeUrl: relativeUrl,
      filePlan: meta.filePlan,
    })
  }

  return []
}
