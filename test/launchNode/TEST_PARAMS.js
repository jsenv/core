import { jsenvCoreDirectoryUrl } from "../../src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const START_COMPILE_SERVER_TEST_PARAMS = {
  logLevel: "off",
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  babelPluginMap: testBabelPluginMap,
  compileDirectoryClean: true,
  compileGroupCount: 2,
}

export const EXECUTE_TEST_PARAMS = {
  collectNamespace: true,
  inheritCoverage: process.env.COVERAGE_ENABLED === "true",
}

export const LAUNCH_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
}
