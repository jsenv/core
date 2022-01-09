import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "./testBabelPluginMap.js"

export const GENERATE_GLOBAL_BUILD_TEST_PARAMS = {
  format: "global",
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  jsenvDirectoryClean: true,
  buildDirectoryClean: true,
  logLevel: "warn",
  babelPluginMap: testBabelPluginMap,
  globalName: "__namespace__",
}
