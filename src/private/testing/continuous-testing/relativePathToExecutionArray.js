import { metaMapToSpecifierMetaMap, normalizeSpecifierMetaMap, urlToMeta } from "@jsenv/url-meta"
import { generateFilePlan } from "../generateFilePlan.js"
import { filePlanToExecutionArray } from "../filePlanToExecutionArray.js"

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
    const filePlan = generateFilePlan(relativePath, executionMeta)
    return filePlanToExecutionArray(filePlan, relativePath)
  }

  return []
}
