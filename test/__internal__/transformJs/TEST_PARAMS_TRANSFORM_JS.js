import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

export const TRANSFORM_JS_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
}

export const TRANSFORM_RESULT_TEST_PARAMS = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  sourcemapExcludeSources: true,
}
