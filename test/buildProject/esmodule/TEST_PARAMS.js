import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../../testBabelPluginMap.js"

export const GENERATE_ESMODULE_BUILD_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  jsenvDirectoryClean: true,
  buildDirectoryClean: true,
  logLevel: "warn",
  babelPluginMap: testBabelPluginMap,
}

export const BROWSER_IMPORT_BUILD_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  mainRelativeUrl: "./main.js",
}

export const NODE_IMPORT_BUILD_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  mainRelativeUrl: "./main.js",
}
