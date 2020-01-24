import { createLogger } from "@jsenv/logger"
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
  launchLogger: createLogger({ logLevel: "info" }),
  executeLogger: createLogger({ logLevel: "info" }),
  stopPlatformAfterExecute: true,
  collectNamespace: true,
  inheritCoverage: process.env.COVERAGE_ENABLED === "true",
}

export const LAUNCH_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
}
