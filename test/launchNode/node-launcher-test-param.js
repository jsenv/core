import { testBabelPluginMap } from "./test-babel-plugin-map.js"
import { launchNodeProjectPath } from "../index.js"

export const NODE_LAUNCHER_TEST_COMPILE_SERVER_PARAM = {
  projectPath: launchNodeProjectPath,
  babelPluginMap: testBabelPluginMap,
  cleanCompileInto: true,
  logLevel: "off",
  compileGroupCount: 2,
}

export const NODE_LAUNCHER_TEST_LAUNCH_PARAM = {
  collectNamespace: true,
  inheritCoverage: process.env.COVERAGE_ENABLED === "true",
}

export const NODE_LAUNCHER_TEST_PARAM = {
  projectPath: launchNodeProjectPath,
  nodeControllableRelativePath: "/src/node-controllable.js",
  nodeExecuteTemplateRelativePath: "/src/node-execute-template.js",
}
