import {
  resolveUrl,
  metaMapToSpecifierMetaMap,
  normalizeSpecifierMetaMap,
  urlToMeta,
} from "@jsenv/util"
import { generateFileExecutionSteps } from "../../executing/generateFileExecutionSteps.js"

export const relativeUrlToExecutionSteps = (relativeUrl, { projectDirectoryUrl, plan }) => {
  const specifierMetaMapForExecution = normalizeSpecifierMetaMap(
    metaMapToSpecifierMetaMap({
      filePlan: plan,
    }),
    projectDirectoryUrl,
  )

  const meta = urlToMeta({
    url: resolveUrl(relativeUrl, projectDirectoryUrl),
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
