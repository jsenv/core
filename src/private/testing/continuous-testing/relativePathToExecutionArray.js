import { metaMapToSpecifierMetaMap, normalizeSpecifierMetaMap, urlToMeta } from "@jsenv/url-meta"
import { generateFilePlan } from "../execution/generateFilePlan.js"
import { filePlanToExecutionArray } from "../execution/filePlanToExecutionArray.js"

export const relativePathToExecutionArray = ({
  projectPathname,
  relativePath,
  executeDescription,
}) => {
  const specifierMetaMapForExecution = normalizeSpecifierMetaMap(
    metaMapToSpecifierMetaMap({
      execute: executeDescription,
    }),
    `file://${projectPathname}`,
    { forceHttpResolutionForFile: true },
  )

  const meta = urlToMeta({
    url: `file://${projectPathname}${relativePath}`,
    specifierMetaMap: specifierMetaMapForExecution,
  })
  if (meta.execute) {
    const executionMeta = meta.execute
    const filePlan = generateFilePlan(relativePath, executionMeta)
    return filePlanToExecutionArray(filePlan, relativePath)
  }

  return []
}
