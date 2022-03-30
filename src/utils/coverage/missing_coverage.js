import { Abort } from "@jsenv/abort"

import { listRelativeFileUrlToCover } from "./list_files_not_covered.js"
import { relativeUrlToEmptyCoverage } from "./empty_coverage_factory.js"

export const getMissingFileByFileCoverage = async ({
  signal,
  rootDirectoryUrl,
  coverageConfig,
  fileByFileCoverage,
}) => {
  const relativeUrlsToCover = await listRelativeFileUrlToCover({
    signal,
    rootDirectoryUrl,
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
          rootDirectoryUrl,
        },
      )
      missingFileByFileCoverage[`./${relativeUrlMissing}`] = emptyCoverage
    })
  }, Promise.resolve())
  return missingFileByFileCoverage
}
