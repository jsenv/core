import { createLogger } from "@jsenv/logger"
import { jsenvCoreDirectoryUrl } from "../../src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"
import { coverageIsEnabled } from "../coverageIsEnabled.js"

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
  stopAfterExecute: true,
  collectNamespace: true,
  inheritCoverage: coverageIsEnabled(),
}

export const LAUNCH_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
}
