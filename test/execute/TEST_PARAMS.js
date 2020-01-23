import { jsenvCoreDirectoryUrl } from "../../src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const EXECUTE_TEST_PARAMS = {
  logLevel: "warn",
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  babelPluginMap: testBabelPluginMap,
  jsenvDirectoryClean: true,
  inheritCoverage: process.env.COVERAGE_ENABLED === "true",
}
