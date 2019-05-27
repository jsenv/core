import { JSENV_PATH } from "../../src/JSENV_PATH.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const TESTING_TEST_PARAM = {
  projectPath: JSENV_PATH,
  babelPluginMap: testBabelPluginMap,
  executionLogLevel: "off",
  collectNamespace: true,
  measureDuration: false,
  captureConsole: false,
}
