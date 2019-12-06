import { urlToFilePath } from "src/internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const GENERATE_COMMONJS_BUNDLE_TEST_PARAMS = {
  projectDirectoryPath: urlToFilePath(jsenvCoreDirectoryUrl),
  jsenvCoreDirectoryClean: true,
  bundleDirectoryClean: true,
  babelPluginMap: testBabelPluginMap,
  logLevel: "warn",
  compileServerLogLevel: "warn",
}

export const REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  mainRelativeUrl: "./main.js",
}
