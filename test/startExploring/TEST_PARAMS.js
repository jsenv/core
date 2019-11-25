import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const START_EXPLORING_TEST_PARAMS = {
  logLevel: "warn",
  compileServerLogLevel: "warn",
  projectDirectoryPath: jsenvCoreDirectoryUrl,
  jsenvDirectoryClean: true,
  babelPluginMap: testBabelPluginMap,
  keepProcessAlive: false,
  livereloading: false,
}
