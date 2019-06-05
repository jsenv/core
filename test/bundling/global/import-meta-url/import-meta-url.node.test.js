import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { generateGlobalBundle } from "../../../../src/bundling/index.js"
import { nodeRequireGlobalBundle } from "../node-require-global-bundle.js"
import {
  GLOBAL_BUNDLING_TEST_GENERATE_PARAM,
  GLOBAL_BUNDLING_TEST_REQUIRE_PARAM,
} from "../global-bundling-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/systemjs`
const fileRelativePath = `${folderJsenvRelativePath}/import-meta-url.js`

await generateGlobalBundle({
  ...GLOBAL_BUNDLING_TEST_GENERATE_PARAM,
  bundleIntoRelativePath,
  entryPointMap: {
    main: fileRelativePath,
  },
})
const { globalValue: actual } = await nodeRequireGlobalBundle({
  ...GLOBAL_BUNDLING_TEST_REQUIRE_PARAM,
  bundleIntoRelativePath,
})
// global bundle do not set a global[globalName]
// value but rather a var so we cannot read that var
// we should ask rollup to make the iffe bundle different
// or support a new format called 'global'
// because iife it just a way to obtain a global variable without polluting
// global in the context of a browser
const expected = undefined

assert({ actual, expected })
