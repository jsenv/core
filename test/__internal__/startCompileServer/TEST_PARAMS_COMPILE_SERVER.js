import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "@jsenv/core/test/testBabelPluginMap.js"

export const COMPILE_SERVER_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  compileServerLogLevel: "warn",
  babelPluginMap: testBabelPluginMap,
  jsenvDirectoryClean: true,
}
