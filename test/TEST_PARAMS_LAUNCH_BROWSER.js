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
  mirrorConsole: false,
  stopAfterExecute: true,
}

export const EXECUTION_TEST_PARAMS = {
  executionLogLevel: "warn",
  stopAfterExecute: true,
  inheritCoverage: coverageIsEnabled(),
}

export const LAUNCH_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
}
