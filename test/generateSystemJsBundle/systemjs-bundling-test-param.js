import { fileUrlToPath } from "../../src/urlHelpers.js"
import { jsenvBundlingDirectoryUrl } from "../../src/jsenvBundlingDirectoryUrl.js"
import { testBabelPluginMap } from "../test-babel-plugin-map.js"

export const SYSTEMJS_BUNDLING_TEST_GENERATE_PARAM = {
  projectDirectoryPath: fileUrlToPath(jsenvBundlingDirectoryUrl),
  bundleDirectoryClean: true,
  babelPluginMap: testBabelPluginMap,
  logLevel: "off",
  throwUnhandled: false,
}

export const SYSTEMJS_BUNDLING_TEST_IMPORT_PARAM = {
  projectDirectoryUrl: jsenvBundlingDirectoryUrl,
  mainRelativePath: "./dist/systemjs/main.js",
}
