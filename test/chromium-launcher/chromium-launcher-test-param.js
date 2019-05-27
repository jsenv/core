import { JSENV_PATH } from "../../src/JSENV_PATH.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const CHROMIUM_LAUNCHER_TEST_COMPILE_SERVER_PARAM = {
  projectPath: JSENV_PATH,
  logLevel: "off",
  cleanCompileInto: true,
  babelPluginMap: testBabelPluginMap,
}

export const CHROMIUM_LAUNCHER_TEST_LAUNCH_PARAM = {
  stopOnceExecuted: true,
  collectNamespace: true,
}

export const CHROMIUM_LAUNCHER_TEST_PARAM = {
  projectPath: JSENV_PATH,
}
