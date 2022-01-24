import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

export const GENERATE_SYSTEMJS_BUILD_TEST_PARAMS = {
  format: "systemjs",
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  buildDirectoryClean: true,
  jsenvDirectoryClean: true,
  logLevel: "warn",
  throwUnhandled: false,
}
