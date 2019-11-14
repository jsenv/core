import { jsenvCoreDirectoryUrl } from "../../src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const COMPILE_SERVER_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  logLevel: "off",
  compileGroupCount: 2,
  babelPluginMap: testBabelPluginMap,
  compileDirectoryClean: true,
}
