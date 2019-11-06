import { fileUrlToPath } from "../../src/private/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "../../src/private/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const EXECUTE_TEST_PARAMS = {
  logLevel: "off",
  projectDirectoryPath: fileUrlToPath(jsenvCoreDirectoryUrl),
  babelPluginMap: testBabelPluginMap,
  compileDirectoryClean: true,
  inheritCoverage: process.env.COVERAGE_ENABLED === "true",
}
