import { basename } from "path"
import { assert } from "@jsenv/assert"
import { generateSystemJsBundle, convertCommonJsWithRollup } from "../../../index.js"
import { resolveDirectoryUrl, urlToRelativeUrl } from "src/internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/internal/jsenvCoreDirectoryUrl.js"
import { browserImportSystemJsBundle } from "../browserImportSystemJsBundle.js"
import {
  GENERATE_SYSTEMJS_BUNDLE_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const bundleDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `${testDirectoryname}.js`

await generateSystemJsBundle({
  ...GENERATE_SYSTEMJS_BUNDLE_TEST_PARAMS,
  // compileServerLogLevel: "debug",
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  // filesystemCache: true,
  bundleDirectoryRelativeUrl,
  entryPointMap: {
    main: `./${testDirectoryRelativeUrl}${mainFilename}`,
  },
  convertMap: {
    "./node_modules/react/index.js": (options) =>
      convertCommonJsWithRollup({
        ...options,
        processEnvNodeEnv: "production",
      }),
  },
})
const { namespace: actual } = await browserImportSystemJsBundle({
  ...IMPORT_SYSTEM_JS_BUNDLE_TEST_PARAMS,
  testDirectoryRelativeUrl,
})
const expected = {
  default: "object",
}
assert({ actual, expected })
