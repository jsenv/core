import { filesToResultMap } from "./filesToResultMap.js"
import { promiseSequence } from "../promiseHelper.js"
import { createCancellationToken } from "../cancellation/index.js"

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
