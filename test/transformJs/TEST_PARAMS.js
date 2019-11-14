import { jsenvCoreDirectoryUrl } from "../../src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const TRANSFORM_JS_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  babelPluginMap: testBabelPluginMap,
}

export const TRANSFORM_RESULT_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
}
