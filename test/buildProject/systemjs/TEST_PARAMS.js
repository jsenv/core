import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../../testBabelPluginMap.js"

export const GENERATE_SYSTEMJS_BUILD_TEST_PARAMS = {
  format: "systemjs",
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  buildDirectoryClean: true,
  jsenvDirectoryClean: true,
  babelPluginMap: testBabelPluginMap,
  logLevel: "warn",
  throwUnhandled: false,
}

export const IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  mainRelativeUrl: "./dist/systemjs/main.js",
}
