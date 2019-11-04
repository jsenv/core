import { fileUrlToPath } from "../../src/urlHelpers.js"
import { jsenvBundlingDirectoryUrl } from "../../src/jsenvBundlingDirectoryUrl.js"
import { testBabelPluginMap } from "../test-babel-plugin-map.js"

export const GLOBAL_BUNDLING_TEST_GENERATE_PARAM = {
  projectDirectoryPath: fileUrlToPath(jsenvBundlingDirectoryUrl),
  babelPluginMap: testBabelPluginMap,
  bundleDirectoryClean: true,
  logLevel: "off",
  throwUnhandled: false,
  globalName: "__namespace__",
}

export const GLOBAL_BUNDLING_TEST_SCRIPTLOAD_PARAM = {
  projectDirectoryUrl: jsenvBundlingDirectoryUrl,
  mainRelativePath: "./main.js",
  globalName: "__namespace__",
}

export const GLOBAL_BUNDLING_TEST_REQUIRE_PARAM = {
  projectDirectoryUrl: jsenvBundlingDirectoryUrl,
  mainRelativePath: "./main.js",
  globalName: "__namespace__",
}
