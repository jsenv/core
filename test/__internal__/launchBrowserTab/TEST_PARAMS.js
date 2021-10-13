import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { jsenvRuntimeSupportDuringDev } from "@jsenv/core/src/jsenvRuntimeSupportDuringDev.js"
import { testBabelPluginMap } from "@jsenv/core/test/testBabelPluginMap.js"
import { coverageIsEnabled } from "@jsenv/core/test/coverageIsEnabled.js"

export const START_COMPILE_SERVER_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,

  compileServerLogLevel: "off",
  jsenvDirectoryClean: true,
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
  stopAfterExecute: true,
}

export const EXECUTION_TEST_PARAMS = {
  logLevel: "info",
  stopAfterExecute: true,
  inheritCoverage: coverageIsEnabled(),
}

export const LAUNCH_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
}
