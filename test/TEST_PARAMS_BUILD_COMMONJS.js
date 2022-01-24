import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

export const GENERATE_COMMONJS_BUILD_TEST_PARAMS = {
  format: "commonjs",
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  jsenvDirectoryClean: true,
  buildDirectoryClean: true,

  logLevel: "warn",
  compileServerLogLevel: "warn",
}

export const REQUIRE_COMMONJS_BUILD_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  mainRelativeUrl: "./main.cjs",
}
