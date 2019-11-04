import { basename } from "path"
import { assert } from "@dmail/assert"
import { generateCommonJsBundle } from "../../../index.js"
import { importMetaUrlToDirectoryRelativePath } from "../../importMetaUrlToDirectoryRelativePath.js"
import { COMMONJS_BUNDLING_TEST_GENERATE_PARAM } from "../commonjs-bundling-test-param.js"

const testDirectoryRelativePath = importMetaUrlToDirectoryRelativePath(import.meta.url)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const bundleDirectoryRelativePath = `${testDirectoryRelativePath}dist/commonjs`
const mainFileBasename = `${testDirectoryBasename}.js`

try {
  await generateCommonJsBundle({
    ...COMMONJS_BUNDLING_TEST_GENERATE_PARAM,
    bundleDirectoryRelativePath,
    entryPointMap: {
      main: `${testDirectoryRelativePath}${mainFileBasename}`,
    },
  })
} catch (actual) {
  const expected = new Error(
    `Module format cjs does not support top-level await. Use the "es" or "system" output formats rather.`,
  )
  expected.code = "INVALID_TLA_FORMAT"
  assert({ actual, expected })
}
