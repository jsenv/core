import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { generateCommonJsBundle } from "../../../../index.js"
import { NODE_BUNDLER_TEST_PARAM } from "../node-bundler-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/node`

try {
  await generateCommonJsBundle({
    ...NODE_BUNDLER_TEST_PARAM,
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
