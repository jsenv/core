import { basename } from "path"
import { assert } from "@jsenv/assert"
import { generateGlobalBundle } from "../../../index.js"
import { resolveDirectoryUrl, fileUrlToRelativePath } from "src/internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "src/internal/jsenvCoreDirectoryUrl.js"
import { scriptLoadGlobalBundle } from "../scriptLoadGlobalBundle.js"
import {
  GENERATE_GLOBAL_BUNDLE_TEST_PARAMS,
  SCRIPT_LOAD_GLOBAL_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = fileUrlToRelativePath(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const bundleDirectoryRelativePath = `${testDirectoryRelativePath}dist/commonjs/`
const mainFileBasename = `${testDirectoryBasename}.js`

await generateGlobalBundle({
  ...GENERATE_GLOBAL_BUNDLE_TEST_PARAMS,
  importMapFileRelativePath: `${testDirectoryRelativePath}importMap.json`,
  bundleDirectoryRelativePath,
  entryPointMap: {
    main: `${testDirectoryRelativePath}${mainFileBasename}`,
  },
})
const { globalValue: actual, serverOrigin } = await scriptLoadGlobalBundle({
  ...SCRIPT_LOAD_GLOBAL_BUNDLE_TEST_PARAMS,
  bundleDirectoryRelativePath,
})
const expected = `${serverOrigin}/main.js`
assert({ actual, expected })
