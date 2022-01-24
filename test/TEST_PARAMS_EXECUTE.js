import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { coverageIsEnabled } from "./coverageIsEnabled.js"

export const EXECUTE_TEST_PARAMS = {
  logLevel: "warn",
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  jsenvDirectoryClean: true,
  inheritCoverage: coverageIsEnabled(),
}
