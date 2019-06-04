import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { testBabelPluginMap } from "../../testBabelPluginMap.js"

export const NODE_BUNDLER_TEST_PARAM = {
  projectPath: JSENV_PATH,
  babelPluginMap: testBabelPluginMap,
  logLevel: "off",
  throwUnhandled: false,
}

export const NODE_BUNDLER_TEST_IMPORT_PARAM = {
  projectPath: JSENV_PATH,
  mainRelativePath: "/main.js",
}
