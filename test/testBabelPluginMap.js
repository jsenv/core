import { namedMetaToMetaMap, resolveMetaMapPatterns, urlToMeta } from "@jsenv/url-meta"
import { jsenvCoverDescription } from "@jsenv/testing"
import { createInstrumentBabelPlugin } from "@jsenv/testing/src/coverage/instrument-babel-plugin.js"
import { jsenvCorePathname } from "../src/jsenvCorePath/jsenvCorePath.js"

const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

const computeTestBabelPluginMap = ({ coverageEnabled }) => {
  if (!coverageEnabled) return jsenvBabelPluginMap

  const coverMetaMap = resolveMetaMapPatterns(
    namedMetaToMetaMap({
      cover: jsenvCoverDescription,
    }),
    `file://${jsenvCorePathname}`,
  )

  return {
    ...jsenvBabelPluginMap,
    ["transform-instrument"]: [
      createInstrumentBabelPlugin({
        predicate: ({ relativePath }) =>
          urlToMeta({
            url: `file://${jsenvCorePathname}${relativePath}`,
            metaMap: coverMetaMap,
          }).cover === true,
      }),
    ],
  }
}

export const testBabelPluginMap = computeTestBabelPluginMap({
  coverageEnabled: process.env.COVERAGE_ENABLED === "true",
})
