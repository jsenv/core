import { jsenvTestingProjectPath } from "../../src/jsenv-testing-project.js"
import { testBabelPluginMap } from "../test-babel-plugin-map.js"

export const CONTINUOUS_TESTING_TEST_PARAM = {
  projectPath: jsenvTestingProjectPath,
  babelPluginMap: testBabelPluginMap,
  executionLogLevel: "off",
  collectNamespace: true,
  measureDuration: false,
  captureConsole: false,
  // cleanCompileInto: true,
}
