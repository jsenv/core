import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { generateSystemJsBundle } from "../../../../src/bundling/index.js"
import { nodeImportSystemJsBundle } from "../node-import-systemjs-bundle.js"
import {
  SYSTEMJS_BUNDLING_TEST_GENERATE_PARAM,
  SYSTEMJS_BUNDLING_TEST_IMPORT_PARAM,
} from "../systemjs-budling-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/systemjs`

await generateSystemJsBundle({
  ...SYSTEMJS_BUNDLING_TEST_GENERATE_PARAM,
  bundleIntoRelativePath,
  entryPointMap: {
    main: `${folderJsenvRelativePath}/import-global-named.js`,
  },
})

const { namespace: actual } = await nodeImportSystemJsBundle({
  ...SYSTEMJS_BUNDLING_TEST_IMPORT_PARAM,
  bundleIntoRelativePath,
})
const expected = { default: 42 }
assert({ actual, expected })
