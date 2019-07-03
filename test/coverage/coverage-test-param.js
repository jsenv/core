import { JSENV_PATH } from "../../src/JSENV_PATH.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const COVERAGE_TEST_PARAM = {
  projectPath: JSENV_PATH,
  babelPluginMap: testBabelPluginMap,
  browserGroupResolverRelativePath: "/src/browser-group-resolver/index.js",
  nodeGroupResolverRelativePath: "/src/node-group-resolver/index.js",
  logLevel: "off",
  executionLogLevel: "off",
  writeCoverageFile: false,
}
