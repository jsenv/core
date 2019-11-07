import { metaMapToSpecifierMetaMap } from "@jsenv/url-meta"
import { matchAllFileInsideFolder, sortPathnameArray } from "@dmail/filesystem-matching"
import { generateFilePlan } from "./generateFilePlan.js"
import { filePlanToExecutionArray } from "./filePlanToExecutionArray.js"

export const generateExecutionArray = async (
  executeDescription,
  { cancellationToken, projectPathname },
) => {
  const specifierMetaMap = metaMapToSpecifierMetaMap({
    execute: executeDescription,
  })

  const plan = {}
  await matchAllFileInsideFolder({
    cancellationToken,
    folderPath: projectPathname,
    specifierMetaMap,
    predicate: ({ execute }) => execute,
    matchingFileOperation: ({ relativePath, meta }) => {
      plan[relativePath] = generateFilePlan(relativePath, meta.execute)
    },
  })

  const sortedPlan = sortPlan(plan)

  return planToExecutionArray(sortedPlan)
}

const sortPlan = (plan) => {
  const sortedPlan = {}
  sortPathnameArray(Object.keys(plan)).forEach((key) => {
    sortedPlan[key] = plan[key]
  })
  return sortedPlan
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
