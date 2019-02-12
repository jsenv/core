import { fileRead } from "@dmail/helper"
import { jsCompile, createInstrumentPlugin } from "../jsCompile/index.js"

export const fileToEmptyCoverage = async (file, { cancellationToken, rootname }) => {
  cancellationToken.throwIfRequested()

  const input = await fileRead(`${rootname}/${file}`)

  // we must compile to get the coverage object
  // without evaluating the file because it would increment coverage
  // and execute code that can be doing anything
  const { assetMap } = await jsCompile({
    rootname,
    file,
    input,
    pluginMap: {
      instrument: [createInstrumentPlugin({ predicate: () => true })],
    },
    remap: false,
  })

  const coverageAsset = assetMap["coverage.json"]
  const coverage = JSON.parse(coverageAsset)
  // https://github.com/gotwarlost/istanbul/blob/bc84c315271a5dd4d39bcefc5925cfb61a3d174a/lib/command/common/run-with-cover.js#L229
  Object.keys(coverage.s).forEach(function(key) {
    coverage.s[key] = 0
  })

  return coverage
}
