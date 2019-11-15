import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const START_EXPLORING_TEST_PARAMS = {
  logLevel: "off",
  compileServerLogLevel: "off",
  projectDirectoryPath: jsenvCoreDirectoryUrl,
  compileDirectoryClean: true,
  HTMLTemplateFileUrl: import.meta.resolve("./template.htnl"),
  babelPluginMap: testBabelPluginMap,
  keepProcessAlive: false,
}
