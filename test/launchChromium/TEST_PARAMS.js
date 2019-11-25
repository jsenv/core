import { jsenvCoreDirectoryUrl } from "../../src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const START_COMPILE_SERVER_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  compileGroupCount: 2,
  compileServerLogLevel: "off",
  jsenvDirectoryClean: true,
  babelPluginMap: testBabelPluginMap,
}

export const EXECUTION_TEST_PARAMS = {
  projectPath: jsenvCoreDirectoryUrl,
  HTMLTemplateRelativePath: "/src/template.html",
  puppeteerExecuteTemplateRelativePath: "/src/puppeteer-execute-template.js",
  stopOnceExecuted: true,
  collectNamespace: true,
  inheritCoverage: process.env.COVERAGE_ENABLED === "true",
}

export const LAUNCH_CHROMIUM_TEST_PARAMS = {}
