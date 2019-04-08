import { fileRead } from "/node_modules/@dmail/helper/index.js"
import { createOperation } from "/node_modules/@dmail/cancellation/index.js"
import { jsCompile } from "../jsCompile/index.js"
import { createInstrumentPlugin } from "./createInstrumentPlugin.js"

const { createFileCoverage } = import.meta.require("istanbul-lib-coverage")

export const filenameRelativeToEmptyCoverage = async ({
  cancellationToken,
  projectFolder,
  filenameRelative,
}) => {
  const filename = `${projectFolder}/${filenameRelative}`
  const input = await createOperation({
    cancellationToken,
    start: () => fileRead(filename),
  })

  // we must compile to get the coverage object
  // without evaluating the file because it would increment coverage
  // and execute code that can be doing anything

  try {
    const { assets, assetsContent } = await createOperation({
      cancellationToken,
      start: () =>
        jsCompile({
          input,
          filename,
          filenameRelative,
          projectFolder,
          babelConfigMap: {
            "transform-instrument": [createInstrumentPlugin({ predicate: () => true })],
          },
          remap: false,
          transformTopLevelAwait: false,
        }),
    })

    const coverageIndex = assets.indexOf("coverage.json")
    const coverageContent = assetsContent[coverageIndex]
    const coverage = JSON.parse(coverageContent)

    // https://github.com/gotwarlost/istanbul/blob/bc84c315271a5dd4d39bcefc5925cfb61a3d174a/lib/command/common/run-with-cover.js#L229
    Object.keys(coverage.s).forEach(function(key) {
      coverage.s[key] = 0
    })

    return coverage
  } catch (e) {
    if (e && e.name === "BABEL_PARSE_ERROR") {
      // return an empty coverage for that file when
      // it contains a syntax error
      const coverage = createFileCoverage(filenameRelative).toJSON()
      return coverage
    }
    throw e
  }
}
