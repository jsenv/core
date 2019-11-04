import { jsenvCoreDirectoryUrl } from "../../src/private/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const EXECUTE_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  babelPluginMap: testBabelPluginMap,
  logLevel: "off",
  compileDirectoryClean: true,
  inheritCoverage: process.env.COVERAGE_ENABLED === "true",
}
