import { JSENV_PATH } from "../../src/JSENV_PATH.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const BROWSER_EXPLORER_SERVER_TEST_PARAM = {
  projectPath: JSENV_PATH,
  babelPluginMap: testBabelPluginMap,
  logLevel: "off",
  compileServerLogLevel: "off",
  keepProcessAlive: false,
}
