import { basename } from "path"
import { assert } from "@dmail/assert"
import { generateGlobalBundle } from "../../../index.js"
import { importMetaUrlToDirectoryRelativePath } from "../../importMetaUrlToDirectoryRelativePath.js"
import { nodeRequireGlobalBundle } from "../node-require-global-bundle.js"
import {
  GLOBAL_BUNDLING_TEST_GENERATE_PARAM,
  GLOBAL_BUNDLING_TEST_REQUIRE_PARAM,
} from "../global-bundling-test-param.js"

const testDirectoryRelativePath = importMetaUrlToDirectoryRelativePath(import.meta.url)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const bundleDirectoryRelativePath = `${testDirectoryRelativePath}dist/global-browser/`
const mainFileBasename = `${testDirectoryBasename}.js`

await generateGlobalBundle({
  ...GLOBAL_BUNDLING_TEST_GENERATE_PARAM,
  bundleDirectoryRelativePath,
  entryPointMap: {
    main: `${testDirectoryRelativePath}${mainFileBasename}`,
  },
})
const { globalValue: actual } = await nodeRequireGlobalBundle({
  ...GLOBAL_BUNDLING_TEST_REQUIRE_PARAM,
  bundleDirectoryRelativePath,
})
// global bundle do not set a global[globalName]
// value but rather a var so we cannot read that var
// we should ask rollup to make the iffe bundle different
// or support a new format called 'global'
// because iife it just a way to obtain a global variable without polluting
// global in the context of a browser
const expected = undefined

assert({ actual, expected })
