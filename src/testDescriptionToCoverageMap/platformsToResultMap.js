import { createCancellationToken } from "@dmail/cancellation"
import { promiseSequence } from "../promiseHelper.js"
import { filesToResultMap } from "./filesToResultMap.js"

export const platformsToResultMap = async ({
  cancellationToken = createCancellationToken(),
  platforms,
}) => {
  const results = await promiseSequence(
    platforms.map(({ files, execute }) => () => {
      return filesToResultMap(files, execute, { cancellationToken })
    }),
    cancellationToken,
  )

  const platformResultMap = {}
  platforms.forEach(({ name }, index) => {
    const filesResultMap = results[index]
    platformResultMap[name] = filesResultMap
  })
  return platformResultMap
}
