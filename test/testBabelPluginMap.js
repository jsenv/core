import { jsenvCoverageConfig } from "@jsenv/core"
import { jsenvBabelPluginMap } from "./jsenvBabelPluginMap.js"
import { babelPluginInstrument } from "../src/internal/executing/coverage/babel-plugin-instrument.js"
import { jsenvCoreDirectoryUrl } from "../src/internal/jsenvCoreDirectoryUrl.js"
import { coverageIsEnabled } from "./coverageIsEnabled.js"

const computeTestBabelPluginMap = ({ coverageEnabled }) => {
  if (!coverageEnabled) {
    return jsenvBabelPluginMap
  }

  return {
    ...jsenvBabelPluginMap,
    ["transform-instrument"]: [
      babelPluginInstrument,
      {
        projectDirectoryUrl: jsenvCoreDirectoryUrl,
        coverageConfig: jsenvCoverageConfig,
      },
    ],
  }
}

export const testBabelPluginMap = computeTestBabelPluginMap({
  coverageEnabled: coverageIsEnabled(),
})
