import { jsenvCoreDirectoryUrl } from "../../src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const CONTINUOUS_TESTING_TEST_PARAM = {
  projectDirectory: jsenvCoreDirectoryUrl,
  babelPluginMap: testBabelPluginMap,
  measureDuration: false,
  captureConsole: false,
  // jsenvDirectoryClean: true,
}
