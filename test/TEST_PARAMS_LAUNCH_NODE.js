import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"

import { coverageIsEnabled } from "./coverageIsEnabled.js"

export const START_COMPILE_SERVER_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  jsenvDirectoryClean: true,
  logLevel: "warn",
}

export const EXECUTE_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  jsenvDirectoryClean: true,
  logLevel: "warn",

  executionLogLevel: "warn",
  inheritCoverage: coverageIsEnabled(),
  debugPort: 40001,
  mirrorConsole: false,
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
