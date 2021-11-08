import { Abort } from "@jsenv/abort"

import { listRelativeFileUrlToCover } from "./list_files_not_covered.js"
import { relativeUrlToEmptyCoverage } from "./relativeUrlToEmptyCoverage.js"

export const getMissingFileByFileCoverage = async ({
  signal,
  projectDirectoryUrl,
  coverageConfig,
  fileByFileCoverage,
  babelPluginMap,
}) => {
  const relativeUrlsToCover = await listRelativeFileUrlToCover({
    signal,
    projectDirectoryUrl,
    coverageConfig,
  })

  const relativeUrlsMissing = relativeUrlsToCover.filter((relativeUrlToCover) =>
    Object.keys(fileByFileCoverage).every((key) => {
      return key !== `./${relativeUrlToCover}`
    }),
  )

  const operation = Abort.startOperation()
  operation.addAbortSignal(signal)

  const missingFileByFileCoverage = {}
  await relativeUrlsMissing.reduce(async (previous, relativeUrlMissing) => {
    operation.throwIfAborted()
    await previous
    await operation.withSignal(async (signal) => {
      const emptyCoverage = await relativeUrlToEmptyCoverage(
        relativeUrlMissing,
        {
          signal,
          projectDirectoryUrl,
          babelPluginMap,
        },
      )
      missingFileByFileCoverage[`./${relativeUrlMissing}`] = emptyCoverage
    })
  }, Promise.resolve())

  return missingFileByFileCoverage
}
