import { fileUrlToPath } from "src/internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const GENERATE_COMMONJS_BUNDLE_FOR_NODE_TEST_PARAMS = {
  projectDirectoryPath: fileUrlToPath(jsenvCoreDirectoryUrl),
  bundleDirectoryClean: true,
  jsenvCoreDirectoryClean: true,
  babelPluginMap: testBabelPluginMap,
  logLevel: "warn",
  compileServerLogLevel: "warn",
}

export const REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  mainRelativeUrl: "./main.js",
}
