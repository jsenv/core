import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { generateGlobalBundle } from "../../../../src/bundling/index.js"
import { browserScriptloadGlobalBundle } from "../browser-scriptload-global-bundle.js"
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
const { globalValue: actual, serverOrigin } = await browserScriptloadGlobalBundle({
  ...GLOBAL_BUNDLING_TEST_REQUIRE_PARAM,
  bundleIntoRelativePath,
})
const expected = `${serverOrigin}/main.js`

assert({ actual, expected })
