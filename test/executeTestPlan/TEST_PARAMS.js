import { fileUrlToPath } from "../../src/private/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "../../src/private/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const EXECUTE_TEST_PARAMS = {
  logLevel: "off",
  projectDirectoryPath: fileUrlToPath(jsenvCoreDirectoryUrl),
  compileDirectoryClean: true,
  babelPluginMap: testBabelPluginMap,
  stepParams: {
    collectNamespace: true,
    measureDuration: false,
    captureConsole: false,
  },
}
