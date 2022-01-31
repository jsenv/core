import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"

export const GENERATE_GLOBAL_BUILD_TEST_PARAMS = {
  format: "global",
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  jsenvDirectoryClean: true,
  buildDirectoryClean: true,
  logLevel: "warn",
}
