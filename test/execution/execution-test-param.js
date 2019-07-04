import { JSENV_PATH } from "../../src/JSENV_PATH.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const EXECUTION_TEST_PARAM = {
  projectPath: JSENV_PATH,
  logLevel: "off",
  babelPluginMap: testBabelPluginMap,
  browserPlatformRelativePath: "/src/browser-platform-service/browser-platform/index.js",
  nodePlatformRelativePath: "/src/node-platform-service/node-platform/index.js",
  browserGroupResolverRelativePath: "/src/browser-group-resolver/index.js",
  nodeGroupResolverRelativePath: "/src/node-group-resolver/index.js",
  inheritCoverage: process.env.COVERAGE_ENABLED === "true",
}
