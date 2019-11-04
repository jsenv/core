import { fileUrlToPath } from "src/private/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/private/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const GENERATE_GLOBAL_BUNDLE_TEST_PARAMS = {
  projectDirectoryPath: fileUrlToPath(jsenvCoreDirectoryUrl),
  babelPluginMap: testBabelPluginMap,
  bundleDirectoryClean: true,
  logLevel: "off",
  throwUnhandled: false,
  globalName: "__namespace__",
}

export const SCRIPT_LOAD_GLOBAL_BUNDLE_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  mainRelativePath: "./main.js",
  globalName: "__namespace__",
}

export const REQUIRE_GLOBAL_BUNDLE_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  mainRelativePath: "./main.js",
  globalName: "__namespace__",
}
