import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "@jsenv/core/test/testBabelPluginMap.js"

export const TRANSFORM_JS_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  babelPluginMap: testBabelPluginMap,
}

export const TRANSFORM_RESULT_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  sourcemapExcludeSources: true,
}
