import {
  resolveUrl,
  metaMapToSpecifierMetaMap,
  normalizeSpecifierMetaMap,
  urlToMeta,
} from "@jsenv/util"
import { createInstrumentBabelPlugin } from "internal/executing/coverage/createInstrumentBabelPlugin.js"
import { jsenvBabelPluginMap, jsenvCoverageConfig } from "../index.js"
import { jsenvCoreDirectoryUrl } from "../src/internal/jsenvCoreDirectoryUrl.js"

const computeTestBabelPluginMap = ({ coverageEnabled }) => {
  if (!coverageEnabled) return jsenvBabelPluginMap

  const specifierMetaMapForCoverage = normalizeSpecifierMetaMap(
    metaMapToSpecifierMetaMap({
      cover: jsenvCoverageConfig,
    }),
    jsenvCoreDirectoryUrl,
  )

  return {
    ...jsenvBabelPluginMap,
    ["transform-instrument"]: [
      createInstrumentBabelPlugin({
        predicate: ({ relativeUrl }) =>
          urlToMeta({
            url: resolveUrl(relativeUrl, jsenvCoreDirectoryUrl),
            specifierMetaMap: specifierMetaMapForCoverage,
          }).cover === true,
      }),
    ],
  }
}

export const testBabelPluginMap = computeTestBabelPluginMap({
  coverageEnabled: process.env.COVERAGE_ENABLED === "true",
})
