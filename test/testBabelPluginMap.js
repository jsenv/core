import {
  resolveUrl,
  metaMapToSpecifierMetaMap,
  normalizeSpecifierMetaMap,
  urlToMeta,
} from "@jsenv/util"
import { createInstrumentBabelPlugin } from "../src/internal/executing/coverage/createInstrumentBabelPlugin.js"
import { jsenvCoreDirectoryUrl } from "../src/internal/jsenvCoreDirectoryUrl.js"
import { jsenvBabelPluginMap, jsenvCoverageConfig } from "../index.js"
import { coverageIsEnabled } from "./coverageIsEnabled.js"

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
  coverageEnabled: coverageIsEnabled(),
})
