import { filesToResultMap } from "./filesToResultMap.js"
import { promiseSequence } from "../promiseHelper.js"
import { cancellationNone } from "../cancel/index.js"

export const platformsToResultMap = async ({ cancellation = cancellationNone, platforms }) => {
  const results = await promiseSequence(
    platforms.map(({ files, execute }) => () => {
      return filesToResultMap(files, execute, { cancellation })
    }),
    cancellation,
  )

  const platformResultMap = {}
  platforms.forEach(({ name }, index) => {
    const filesResultMap = results[index]
    platformResultMap[name] = filesResultMap
  })
  return platformResultMap
}
