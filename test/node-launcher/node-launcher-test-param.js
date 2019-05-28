import { JSENV_PATH } from "../../src/JSENV_PATH.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const NODE_LAUNCHER_TEST_COMPILE_SERVER_PARAM = {
  projectPath: JSENV_PATH,
  babelPluginMap: testBabelPluginMap,
  cleanCompileInto: true,
  logLevel: "off",
}

export const NODE_LAUNCHER_TEST_LAUNCH_PARAM = {
  collectNamespace: true,
  inheritCoverage: process.env.COVERAGE_ENABLED === "true",
}

export const NODE_LAUNCHER_TEST_PARAM = {
  projectPath: JSENV_PATH,
}
