import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "./testBabelPluginMap.js"
import { coverageIsEnabled } from "./coverageIsEnabled.js"

export const START_COMPILE_SERVER_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  jsenvDirectoryClean: true,
  compileServerLogLevel: "warn",
  babelPluginMap: testBabelPluginMap,
}

export const EXECUTE_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  jsenvDirectoryClean: true,
  compileServerLogLevel: "warn",
  babelPluginMap: testBabelPluginMap,

  executionLogLevel: "warn",
  inheritCoverage: coverageIsEnabled(),
}

export const EXECUTION_TEST_PARAMS = {
  executionLogLevel: "warn",
  stopAfterExecute: true,
  inheritCoverage: coverageIsEnabled(),
}

export const LAUNCH_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
}
