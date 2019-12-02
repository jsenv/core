import { createLogger } from "@jsenv/logger"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const START_COMPILE_SERVER_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  jsenvDirectoryClean: true,
  compileGroupCount: 2,
  compileServerLogLevel: "warn",
  babelPluginMap: testBabelPluginMap,
}

export const EXECUTION_TEST_PARAMS = {
  launchLogger: createLogger({ logLevel: "warn" }),
  executeLogger: createLogger({ logLevel: "warn" }),
  stopPlatformAfterExecute: true,
  collectNamespace: true,
  inheritCoverage: process.env.COVERAGE_ENABLED === "true",
}

export const LAUNCH_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
}
