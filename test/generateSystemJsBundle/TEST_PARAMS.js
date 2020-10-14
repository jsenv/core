import { jsenvCoreDirectoryUrl } from "../../src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const GENERATE_SYSTEMJS_BUNDLE_TEST_PARAMS = {
  format: "systemjs",
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  bundleDirectoryClean: true,
  jsenvDirectoryClean: true,
  babelPluginMap: testBabelPluginMap,
  logLevel: "warn",
  throwUnhandled: false,
}

export const IMPORT_SYSTEM_JS_BUNDLE_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  mainRelativeUrl: "./dist/systemjs/main.js",
}
