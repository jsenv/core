import { exploringServerProjectPath } from "../src/exploring-server-project.js"
import { testBabelPluginMap } from "./test-babel-plugin-map.js"

export const EXPLORING_SERVER_TEST_PARAM = {
  projectPath: exploringServerProjectPath,
  babelPluginMap: testBabelPluginMap,
  HTMLTemplateRelativePath: "/src/template.html",
  browserSelfExecuteTemplateRelativePath: "/src/browser-self-execute-template.js",
  logLevel: "off",
  compileServerLogLevel: "off",
  keepProcessAlive: false,
  cleanCompileInto: true,
}
