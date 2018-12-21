import { createCancellationToken } from "@dmail/cancellation"
import { promiseSequence } from "../promiseHelper.js"
import { filesToResultMap } from "./filesToResultMap.js"

export const executionPlanToPlatformResultMap = async (
  executionPlan,
  { cancellationToken = createCancellationToken() },
) => {
  const platformResultMap = {}
  await promiseSequence(
    Object.keys(executionPlan).map((platformName) => {
      return async () => {
        const { files, launchPlatform } = executionPlan[platformName]
        const resultMap = await filesToResultMap(files, launchPlatform, { cancellationToken })
        platformResultMap[platformName] = resultMap
        return resultMap
      }
    }),
    cancellationToken,
  )
  return platformResultMap
}
