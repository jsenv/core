import { getCoverageMapAndOutputMapForFiles } from "./getCoverageMapAndOutputMapForFiles.js"
import { getCoverageMapForFilesMissed, getFilesMissed } from "./getCoverageMapForFilesMissed.js"
import { coverageMapCompose } from "./coverageMapCompose.js"
import { promiseSequence } from "../promiseHelper.js"
import { cancellationNone } from "../cancel/index.js"

export const getCoverageAndOutputForClients = async ({
  cancellation = cancellationNone,
  compileFile,
  filesToCover = [],
  clients = [],
}) => {
  const results = await promiseSequence(
    clients.map(({ execute, files }) => () => {
      return getCoverageMapAndOutputMapForFiles({
        cancellation,
        execute,
        files,
      })
    }),
    cancellation,
  )

  // compose all coverageMaps into one
  // and check if all files supposed to be covered where actually covered
  // if not add empty coverage for thoose files and return
  // a coverageMap with all this
  const getFinalCoverageMap = (coverageMaps) => {
    const coverageMapComposed = coverageMapCompose(...coverageMaps)

    return {
      ...coverageMapComposed,
      ...getCoverageMapForFilesMissed({
        cancellation,
        filesMissed: getFilesMissed(coverageMapComposed, filesToCover),
        compileFile,
      }),
    }
  }

  const outputs = results.map(({ outputMap }) => outputMap)
  const coverageMaps = results.map(({ coverageMap }) => coverageMap)
  const coverageMap = getFinalCoverageMap(coverageMaps)

  return {
    outputs,
    coverageMaps,
    coverageMap,
  }
}
