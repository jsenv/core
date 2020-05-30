import { babelPluginInstrument } from "../src/internal/executing/coverage/babel-plugin-instrument.js"
import { jsenvCoreDirectoryUrl } from "../src/internal/jsenvCoreDirectoryUrl.js"
import { jsenvBabelPluginMap, jsenvCoverageConfig } from "../index.js"
import { coverageIsEnabled } from "./coverageIsEnabled.js"

const computeTestBabelPluginMap = ({ coverageEnabled }) => {
  if (!coverageEnabled) return jsenvBabelPluginMap

  return {
    ...jsenvBabelPluginMap,
    ["transform-instrument"]: [
      babelPluginInstrument,
      { projectDirectoryUrl: jsenvCoreDirectoryUrl, coverageConfig: jsenvCoverageConfig },
    ],
  }
}

export const testBabelPluginMap = computeTestBabelPluginMap({
  coverageEnabled: coverageIsEnabled(),
})
