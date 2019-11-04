import { basename } from "path"
import { assert } from "@dmail/assert"
import { generateGlobalBundle } from "../../../index.js"
import { importMetaUrlToDirectoryRelativePath } from "../../importMetaUrlToDirectoryRelativePath.js"
import { browserScriptloadGlobalBundle } from "../browser-scriptload-global-bundle.js"
import {
  GLOBAL_BUNDLING_TEST_GENERATE_PARAM,
  GLOBAL_BUNDLING_TEST_SCRIPTLOAD_PARAM,
} from "../global-bundling-test-param.js"

const testDirectoryRelativePath = importMetaUrlToDirectoryRelativePath(import.meta.url)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const bundleDirectoryRelativePath = `${testDirectoryRelativePath}dist/commonjs/`
const mainFileBasename = `${testDirectoryBasename}.js`

await generateGlobalBundle({
  ...GLOBAL_BUNDLING_TEST_GENERATE_PARAM,
  bundleDirectoryRelativePath,
  entryPointMap: {
    main: `${testDirectoryRelativePath}${mainFileBasename}`,
  },
})
const { globalValue: actual } = await browserScriptloadGlobalBundle({
  ...GLOBAL_BUNDLING_TEST_SCRIPTLOAD_PARAM,
  bundleDirectoryRelativePath,
})
const expected = [0, 1]
assert({ actual, expected })
