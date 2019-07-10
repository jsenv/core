import { JSENV_PATH } from "../../src/JSENV_PATH.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const TESTING_TEST_PARAM = {
  projectPath: JSENV_PATH,
  babelPluginMap: testBabelPluginMap,
  browserPlatformRelativePath: "/src/browser-platform-service/browser-platform/index.js",
  nodePlatformRelativePath: "/src/node-platform-service/node-platform/index.js",
  browserGroupResolverRelativePath: "/src/balancing/browser-group-resolver.js",
  nodeGroupResolverRelativePath: "/src/balancing/node-group-resolver.js",
  executionLogLevel: "off",
  collectNamespace: true,
  measureDuration: false,
  captureConsole: false,
}
