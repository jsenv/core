import { metaMapToSpecifierMetaMap } from "@jsenv/url-meta"
import { collectFiles } from "@jsenv/file-collector"
import { pathToFileUrl } from "../urlUtils.js"
import { generateFileExecutionStepConfigMap } from "./generateFileExecutionStepConfigMap.js"

export const generateExecutionSteps = async (plan, { cancellationToken, projectDirectoryUrl }) => {
  const specifierMetaMap = metaMapToSpecifierMetaMap({
    executeStep: plan,
  })

  const fileResultArray = await collectFiles({
    cancellationToken,
    directoryPath: pathToFileUrl(projectDirectoryUrl),
    specifierMetaMap,
    predicate: ({ executeStep }) => executeStep,
  })

  const executionSteps = []
  fileResultArray.forEach(({ relativePath, meta }) => {
    const fileExecutionStepConfigMap = generateFileExecutionStepConfigMap(
      relativePath,
      meta.executeStep,
    )
    Object.keys(fileExecutionStepConfigMap).forEach((name) => {
      executionSteps.push({
        name,
        fileRelativePath: relativePath,
        ...fileExecutionStepConfigMap[name],
      })
    })
  })

  return executionSteps
}
