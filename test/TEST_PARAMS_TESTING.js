import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

export const EXECUTE_TEST_PLAN_TEST_PARAMS = {
  logLevel: "warn",
  updateProcessExitCode: false,
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  jsenvDirectoryClean: true,
  coverageTextLog: false,
  coverageJsonFile: false,
  coverageHtmlDirectory: false,
  windowsProcessExitFix: false,
}
