import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "./testBabelPluginMap.js"

export const START_EXPLORING_TEST_PARAMS = {
  logLevel: "warn",
  protocol: "https",
  compileServerLogLevel: "warn",
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  jsenvDirectoryClean: true,
  babelPluginMap: testBabelPluginMap,
  keepProcessAlive: false,
  // livereloading: false,
}
