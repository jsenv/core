import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "@jsenv/core/test/testBabelPluginMap.js"
import { jsenvRuntimeSupportDuringDev } from "@jsenv/core/src/jsenvRuntimeSupportDuringDev.js"

export const COMPILE_SERVER_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  compileServerLogLevel: "warn",
  babelPluginMap: testBabelPluginMap,
  jsenvDirectoryClean: true,
  runtimeSupport: jsenvRuntimeSupportDuringDev,
}
