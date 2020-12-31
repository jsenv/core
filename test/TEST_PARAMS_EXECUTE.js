import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "./testBabelPluginMap.js"
import { coverageIsEnabled } from "./coverageIsEnabled.js"

export const EXECUTE_TEST_PARAMS = {
  logLevel: "warn",
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  babelPluginMap: testBabelPluginMap,
  jsenvDirectoryClean: true,
  inheritCoverage: coverageIsEnabled(),
}
