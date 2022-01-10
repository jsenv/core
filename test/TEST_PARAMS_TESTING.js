import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "./testBabelPluginMap.js"

export const EXECUTE_TEST_PLAN_TEST_PARAMS = {
  logLevel: "warn",
  updateProcessExitCode: false,
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  jsenvDirectoryClean: true,
  babelPluginMap: testBabelPluginMap,
  coverageTextLog: false,
  coverageJsonFile: false,
  coverageHtmlDirectory: false,
  windowsProcessExitFix: false,
}
