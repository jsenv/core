import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { generateCommonJsBundle } from "../../../../index.js"
import { COMMONJS_BUNDLING_TEST_GENERATE_PARAM } from "../commonjs-bundling-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/commonjs`

try {
  await generateCommonJsBundle({
    ...COMMONJS_BUNDLING_TEST_GENERATE_PARAM,
    bundleIntoRelativePath,
    entryPointMap: {
      main: `${folderJsenvRelativePath}/top-level-await.js`,
    },
  })
} catch (e) {
  const expected = new Error(
    `Module format cjs does not support top-level await. Use the "es" or "system" output formats rather.`,
  )
  expected.code = "INVALID_TLA_FORMAT"
  assert({
    actual: e,
    expected,
  })
}
