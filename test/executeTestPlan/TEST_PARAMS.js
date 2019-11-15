import { fileUrlToPath } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const EXECUTE_TEST_PARAMS = {
  logLevel: "off",
  projectDirectoryPath: fileUrlToPath(jsenvCoreDirectoryUrl),
  compileDirectoryClean: true,
  babelPluginMap: testBabelPluginMap,
  executionDefaultOptions: {
    collectNamespace: true,
    measureDuration: false,
    captureConsole: false,
  },
  coverageTextLog: false,
  coverageJsonFile: false,
  coverageHtmlDirectory: false,
}
