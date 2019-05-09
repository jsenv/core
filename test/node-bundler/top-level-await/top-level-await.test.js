import { assert } from "@dmail/assert"
import { hrefToFolderJsenvRelative } from "../../../src/hrefToFolderJsenvRelative.js"
import { ROOT_FOLDER } from "../../../src/ROOT_FOLDER.js"
import { bundleNode } from "../../../index.js"

const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const projectFolder = `${ROOT_FOLDER}`
const bundleInto = `${testFolderRelative}/dist/node`

try {
  await bundleNode({
    projectFolder,
    into: bundleInto,
    entryPointMap: {
      main: `${testFolderRelative}/top-level-await.js`,
    },
    logBundleFilePaths: false,
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
