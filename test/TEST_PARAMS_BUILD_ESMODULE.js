import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

export const GENERATE_ESMODULE_BUILD_TEST_PARAMS = {
  format: "esmodule",
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  jsenvDirectoryClean: true,
  buildDirectoryClean: true,
  logLevel: "warn",
}

export const NODE_IMPORT_BUILD_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  jsFileRelativeUrl: "./dist/esmodule/main.js",
}
