import { jsenvCoreDirectoryUrl } from "../../src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const COMPILE_SERVER_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  compileServerLogLevel: "warn",
  babelPluginMap: testBabelPluginMap,
  compileDirectoryClean: true,
  compileGroupCount: 2,
}
