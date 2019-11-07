import { metaMapToSpecifierMetaMap } from "@jsenv/url-meta"
import { collectFiles } from "@jsenv/file-collector"
import { pathToFileUrl } from "../urlUtils.js"
import { generateFilePlan } from "./generateFilePlan.js"
import { filePlanToExecutionArray } from "./filePlanToExecutionArray.js"

export const generateExecutionArray = async (
  executionConfig,
  { cancellationToken, projectDirectoryUrl },
) => {
  const specifierMetaMap = metaMapToSpecifierMetaMap({
    execute: executionConfig,
  })

  const fileResultArray = await collectFiles({
    cancellationToken,
    directoryPath: pathToFileUrl(projectDirectoryUrl),
    specifierMetaMap,
    predicate: ({ execute }) => execute,
  })
  const plan = {}
  fileResultArray.forEach(({ relativePath, meta }) => {
    plan[relativePath] = generateFilePlan(relativePath, meta.execute)
  })

  return planToExecutionArray(plan)
}

const planToExecutionArray = (plan) => {
  const plannedExecutionArray = []
  Object.keys(plan).forEach((fileRelativePath) => {
    plannedExecutionArray.push(
      ...filePlanToExecutionArray(plan[fileRelativePath], fileRelativePath),
    )
  })
  return plannedExecutionArray
}
