import { jsCompile, createInstrumentPlugin } from "../jsCompile/index.js"
import { readFile } from "../fileHelper.js"

export const platformCoverageMapToCoverageMap = async ({
  cancellationToken,
  localRoot,
  platformCoverageMap,
  filesToCover,
}) => {
  const filesMissed = platformCoverageMapToFilesMissed(platformCoverageMap, filesToCover)

  const missedCoverageMap = {}
  await Promise.all(
    filesMissed.map(async (file) => {
      const emptyCoverage = await fileToEmptyCoverage({ cancellationToken, localRoot, file })
      missedCoverageMap[file] = emptyCoverage
      return emptyCoverage
    }),
  )

  return {
    ...platformCoverageMap,
    ...missedCoverageMap,
  }
}

const platformCoverageMapToFilesMissed = (coverageMap, filesToCover) =>
  filesToCover.filter((file) => file in coverageMap === false)

const fileToEmptyCoverage = async ({ cancellationToken, localRoot, file }) => {
  cancellationToken.throwIfRequested()

  try {
    const inputSource = await readFile(`${localRoot}/${file}`)

    // we must compile to get the coverage object
    // without evaluating the file because it would increment coverage
    // and execute code that can be doing anything
    const { assetMap } = await jsCompile({
      localRoot,
      inputName: file,
      inputSource,
      plugins: [createInstrumentPlugin()],
      remap: false,
    })

    const coverageAsset = assetMap["coverage.json"]
    const coverage = JSON.parse(coverageAsset)
    // https://github.com/gotwarlost/istanbul/blob/bc84c315271a5dd4d39bcefc5925cfb61a3d174a/lib/command/common/run-with-cover.js#L229
    Object.keys(coverage.s).forEach(function(key) {
      coverage.s[key] = 0
    })

    return coverage
  } catch (e) {
    // why do we consider parse error returns an empty coveragemap ?
    // I think this is a valid reason to throw and we should not ignore that error
    if (e && e.name === "PARSE_ERROR") {
      return {}
    }
    throw e
  }
}
