import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { generateGlobalBundle } from "../../../../src/bundling/index.js"
import { GLOBAL_BUNDLING_TEST_GENERATE_PARAM } from "../global-bundling-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/global`
const fileRelativePath = `${folderJsenvRelativePath}/dynamic-import.js`

try {
  await generateGlobalBundle({
    ...GLOBAL_BUNDLING_TEST_GENERATE_PARAM,
    bundleIntoRelativePath,
    entryPointMap: {
      main: fileRelativePath,
    },
  })
} catch (e) {
  const actual = e
  const expected = new Error(
    "UMD and IIFE output formats are not supported for code-splitting builds.",
  )
  expected.code = "INVALID_OPTION"
  assert({ actual, expected })
}
