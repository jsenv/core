import { cancellationNone } from "../cancel/index.js"
import { jsCompile, createInstrumentPlugin } from "../jsCompile/index.js"
import { readFile } from "../fileHelper.js"

export const getFilesMissed = (coverageMap, files) =>
  files.filter((file) => file in coverageMap === false)

const getEmptyCoverageFor = async ({ cancellation, localRoot, file }) => {
  await cancellation.toPromise()

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
  const coverage = JSON.parse(coverageAsset.content)
  // https://github.com/gotwarlost/istanbul/blob/bc84c315271a5dd4d39bcefc5925cfb61a3d174a/lib/command/common/run-with-cover.js#L229
  Object.keys(coverage.s).forEach(function(key) {
    coverage.s[key] = 0
  })

  return coverage
}

export const getCoverageMapForFilesMissed = async ({
  localRoot,
  cancellation = cancellationNone,
  files,
}) => {
  const coverageMapMissed = {}
  await Promise.all(
    files.map(async (file) => {
      const emptyCoverage = await getEmptyCoverageFor({ cancellation, localRoot, file })
      coverageMapMissed[file] = emptyCoverage
    }),
  )
  return coverageMapMissed
}
