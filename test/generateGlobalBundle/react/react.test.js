import { basename } from "path"
import { assert } from "@jsenv/assert"
import { generateGlobalBundle, convertCommonJsWithRollup } from "../../../index.js"
import { resolveDirectoryUrl, urlToRelativePath } from "src/internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/internal/jsenvCoreDirectoryUrl.js"
import { scriptLoadGlobalBundle } from "../scriptLoadGlobalBundle.js"
import {
  GENERATE_GLOBAL_BUNDLE_TEST_PARAMS,
  SCRIPT_LOAD_GLOBAL_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativePath(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const bundleDirectoryRelativeUrl = `${testDirectoryRelativePath}dist/commonjs/`
const mainFileBasename = `${testDirectoryBasename}.js`

await generateGlobalBundle({
  ...GENERATE_GLOBAL_BUNDLE_TEST_PARAMS,
  bundleDirectoryRelativeUrl,
  entryPointMap: {
    main: `${testDirectoryRelativePath}${mainFileBasename}`,
  },
  convertMap: {
    "./node_modules/react/index.js": (options) =>
      convertCommonJsWithRollup({ ...options, processEnvNodeEnv: "dev" }),
  },
})
const { globalValue: actual } = await scriptLoadGlobalBundle({
  ...SCRIPT_LOAD_GLOBAL_BUNDLE_TEST_PARAMS,
  bundleDirectoryRelativeUrl,
})
const expected = "object"
assert({ actual, expected })
