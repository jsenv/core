import { metaMapToSpecifierMetaMap, normalizeSpecifierMetaMap, urlToMeta } from "@jsenv/url-meta"
import { generateFileExecutionPlan } from "../test-execution/generateFileExecutionPlan.js"
import { fileExecutionPlanToArray } from "../filePlanToExecutionArray.js"

export const relativePathToExecutionArray = ({
  projectDirectoryUrl,
  relativePath,
  executeDescription,
}) => {
  const specifierMetaMapForExecution = normalizeSpecifierMetaMap(
    metaMapToSpecifierMetaMap({
      execute: executeDescription,
    }),
    projectDirectoryUrl,
  )

  const meta = urlToMeta({
    url: `${projectDirectoryUrl}${relativePath}`,
    specifierMetaMap: specifierMetaMapForExecution,
  })
  if (meta.execute) {
    const executionMeta = meta.execute
    const filePlan = generateFileExecutionPlan(relativePath, executionMeta)
    return filePlanToExecutionArray(filePlan, relativePath)
  }

  return []
}
