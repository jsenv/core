import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { generateSystemJsBundle } from "../../../../src/bundling/index.js"
import { browserImportSystemJsBundle } from "../browser-import-systemjs-bundle.js"
import {
  SYSTEMJS_BUNDLING_TEST_GENERATE_PARAM,
  SYSTEMJS_BUNDLING_TEST_IMPORT_PARAM,
} from "../systemjs-bundling-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/systemjs`

await generateSystemJsBundle({
  ...SYSTEMJS_BUNDLING_TEST_GENERATE_PARAM,
  bundleIntoRelativePath,
  entryPointMap: {
    main: `${folderJsenvRelativePath}/import-meta-url.js`,
  },
})
const { namespace: actual, serverOrigin } = await browserImportSystemJsBundle({
  ...SYSTEMJS_BUNDLING_TEST_IMPORT_PARAM,
  bundleIntoRelativePath,
})
const expected = { default: `${serverOrigin}/main.js` }
assert({ actual, expected })
