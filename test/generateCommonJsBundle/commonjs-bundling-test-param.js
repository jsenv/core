import { fileUrlToPath } from "../../src/urlHelpers.js"
import { jsenvBundlingDirectoryUrl } from "../../src/jsenvBundlingDirectoryUrl.js"
import { testBabelPluginMap } from "../test-babel-plugin-map.js"

const jsenvBundlingDirectoryPath = fileUrlToPath(jsenvBundlingDirectoryUrl)

export const COMMONJS_BUNDLING_TEST_GENERATE_PARAM = {
  projectDirectoryPath: jsenvBundlingDirectoryPath,
  bundleDirectoryClean: true,
  babelPluginMap: testBabelPluginMap,
  logLevel: "off",
  throwUnhandled: false,
}

export const COMMONJS_BUNDLING_TEST_REQUIRE_PARAM = {
  projectDirectoryUrl: jsenvBundlingDirectoryUrl,
  mainRelativePath: "./main.js",
}
