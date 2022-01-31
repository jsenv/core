import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"

export const TRANSFORM_JS_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  babelPluginMap: {},
}

export const TRANSFORM_RESULT_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  sourcemapExcludeSources: true,
}
