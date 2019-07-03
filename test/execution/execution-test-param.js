import { JSENV_PATH } from "../../src/JSENV_PATH.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const EXECUTION_TEST_PARAM = {
  projectPath: JSENV_PATH,
  logLevel: "off",
  babelPluginMap: testBabelPluginMap,
  browserGroupResolverRelativePath: "/src/browser-group-resolver/index.js",
  nodeGroupResolverRelativePath: "/src/node-group-resolver/index.js",
  inheritCoverage: process.env.COVERAGE_ENABLED === "true",
}
