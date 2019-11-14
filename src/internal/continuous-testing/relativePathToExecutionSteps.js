import { metaMapToSpecifierMetaMap, normalizeSpecifierMetaMap, urlToMeta } from "@jsenv/url-meta"
import { generateFileExecutionSteps } from "../test-execution/generateFileExecutionSteps.js"

export const relativePathToExecutionSteps = ({ projectDirectoryUrl, relativePath, plan }) => {
  const specifierMetaMapForExecution = normalizeSpecifierMetaMap(
    metaMapToSpecifierMetaMap({
      filePlan: plan,
    }),
    projectDirectoryUrl,
  )

  const meta = urlToMeta({
    url: `${projectDirectoryUrl}${relativePath}`,
    specifierMetaMap: specifierMetaMapForExecution,
  })
  if (meta.filePlan) {
    return generateFileExecutionSteps({
      fileRelativePath: relativePath,
      filePlan: meta.filePlan,
    })
  }

  return []
}
