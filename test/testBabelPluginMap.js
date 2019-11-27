import { metaMapToSpecifierMetaMap, normalizeSpecifierMetaMap, urlToMeta } from "@jsenv/url-meta"
import { jsenvCoverDescription } from "@jsenv/testing"
import { createInstrumentBabelPlugin } from "@jsenv/testing/src/coverage/instrument-babel-plugin.js"
import { jsenvBabelPluginMap } from "../index.js"
import { resolveUrl } from "../src/internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "../src/internal/jsenvCoreDirectoryUrl.js"

const computeTestBabelPluginMap = ({ coverageEnabled }) => {
  if (!coverageEnabled) return jsenvBabelPluginMap

  const specifierMetaMapForCoverage = normalizeSpecifierMetaMap(
    metaMapToSpecifierMetaMap({
      cover: jsenvCoverDescription,
    }),
    jsenvCoreDirectoryUrl,
  )

  return {
    ...jsenvBabelPluginMap,
    ["transform-instrument"]: [
      createInstrumentBabelPlugin({
        predicate: ({ relativePath }) =>
          urlToMeta({
            url: resolveUrl(relativePath.slice(1), jsenvCoreDirectoryUrl),
            specifierMetaMap: specifierMetaMapForCoverage,
          }).cover === true,
      }),
    ],
  }
}

export const testBabelPluginMap = computeTestBabelPluginMap({
  coverageEnabled: process.env.COVERAGE_ENABLED === "true",
})
