import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "@jsenv/core/test/testBabelPluginMap.js"

export const CONTINUOUS_TESTING_TEST_PARAM = {
  projectDirectory: jsenvCoreDirectoryUrl,
  babelPluginMap: testBabelPluginMap,
  measureDuration: false,
  captureConsole: false,
  // jsenvDirectoryClean: true,
}
