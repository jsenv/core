import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { jsenvRuntimeSupportDuringDev } from "@jsenv/core/src/jsenvRuntimeSupportDuringDev.js"
import { testBabelPluginMap } from "./testBabelPluginMap.js"
import { coverageIsEnabled } from "./coverageIsEnabled.js"

export const START_COMPILE_SERVER_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  jsenvDirectoryClean: true,
  compileServerLogLevel: "warn",
  babelPluginMap: testBabelPluginMap,
  runtimeSupport: jsenvRuntimeSupportDuringDev,
}

export const EXECUTE_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  jsenvDirectoryClean: true,
  compileServerLogLevel: "warn",
  babelPluginMap: testBabelPluginMap,

  executionLogLevel: "warn",
  inheritCoverage: coverageIsEnabled(),
  debugPort: 40001,
  stopAfterExecute: true,
}

export const LAUNCH_AND_EXECUTE_TEST_PARAMS = {
  executionLogLevel: "warn",
  inheritCoverage: coverageIsEnabled(),
}

export const LAUNCH_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  debugPort: 40001,
}
