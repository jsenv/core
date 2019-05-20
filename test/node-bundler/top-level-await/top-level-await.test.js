import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { bundleNode } from "../../../index.js"

const projectPath = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/node`

try {
  await bundleNode({
    projectPath,
    bundleIntoRelativePath,
    entryPointMap: {
      main: `${folderJsenvRelativePath}/top-level-await.js`,
    },
    logLevel: "off",
    throwUnhandled: false,
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
