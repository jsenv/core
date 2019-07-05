import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { testBabelPluginMap } from "../../testBabelPluginMap.js"

export const GLOBAL_BUNDLING_TEST_GENERATE_PARAM = {
  projectPath: JSENV_PATH,
  globalThisHelperRelativePath: "/src/bundling/jsenv-rollup-plugin/global-this.js",
  babelPluginMap: testBabelPluginMap,
  logLevel: "off",
  throwUnhandled: false,
  globalName: "__namespace__",
}

export const GLOBAL_BUNDLING_TEST_SCRIPTLOAD_PARAM = {
  projectPath: JSENV_PATH,
  mainRelativePath: "/main.js",
  globalName: "__namespace__",
}

export const GLOBAL_BUNDLING_TEST_REQUIRE_PARAM = {
  projectPath: JSENV_PATH,
  mainRelativePath: "/main.js",
  globalName: "__namespace__",
}
