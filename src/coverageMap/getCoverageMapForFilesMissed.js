import { cancellationNone } from "../cancel/index.js"

export const getFilesMissed = (coverageMap, files) =>
  files.filter((file) => file in coverageMap === false)

export const getCoverageMapForFilesMissed = ({
  cancellation = cancellationNone,
  files,
  compileFile,
}) => {
  const getEmptyCoverageFor = (file) => {
    // we must compileFile to get the coverage object
    // without evaluating the file source because it would increment coverage
    // and also execute code that is not supposed to be run
    return cancellation.wrap(() => {
      return compileFile(file).then(({ assetMap }) => {
        const coverageAsset = assetMap["coverage.json"]
        const coverage = JSON.parse(coverageAsset.content)
        // https://github.com/gotwarlost/istanbul/blob/bc84c315271a5dd4d39bcefc5925cfb61a3d174a/lib/command/common/run-with-cover.js#L229
        Object.keys(coverage.s).forEach(function(key) {
          coverage.s[key] = 0
        })
        return coverage
      })
    })
  }

  const coverageMapMissed = {}
  return Promise.all(
    files.map((file) => {
      return getEmptyCoverageFor(file).then((emptyCoverage) => {
        coverageMapMissed[file] = emptyCoverage
      })
    }),
  ).then(() => coverageMapMissed)
}
