import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { generateSystemJsBundle } from "../../../../src/bundling/index.js"
import { importBrowserBundle } from "../import-browser-bundle.js"
import {
  BROWSER_BUNDLER_TEST_PARAM,
  BROWSER_BUNDLER_TEST_IMPORT_PARAM,
} from "../browser-bundler-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/browser`
const fileRelativePath = `${folderJsenvRelativePath}/without-balancing.js`

await generateSystemJsBundle({
  ...BROWSER_BUNDLER_TEST_PARAM,
  bundleIntoRelativePath,
  entryPointMap: {
    main: fileRelativePath,
  },
})
const { namespace: actual } = await importBrowserBundle({
  ...BROWSER_BUNDLER_TEST_IMPORT_PARAM,
  bundleIntoRelativePath,
})
const expected = { default: 42 }
assert({ actual, expected })
