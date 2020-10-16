import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../../testBabelPluginMap.js"

export const GENERATE_COMMONJS_BUNDLE_TEST_PARAMS = {
  format: "commonjs",
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  jsenvDirectoryClean: true,
  bundleDirectoryClean: true,
  babelPluginMap: testBabelPluginMap,
  logLevel: "warn",
  compileServerLogLevel: "warn",
}

export const REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  mainRelativeUrl: "./main.cjs",
}
