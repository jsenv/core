import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "./testBabelPluginMap.js"

export const START_DEV_SERVER_TEST_PARAMS = {
  logLevel: "warn",
  protocol: "http",
  compileServerLogLevel: "warn",
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  jsenvDirectoryClean: true,
  babelPluginMap: testBabelPluginMap,
  keepProcessAlive: false,
  // livereloading: false,
}
