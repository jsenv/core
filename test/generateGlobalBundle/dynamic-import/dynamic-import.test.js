import { basename } from "path"
import { assert } from "@dmail/assert"
import { generateGlobalBundle } from "../../../index.js"
import { importMetaUrlToDirectoryRelativePath } from "../../importMetaUrlToDirectoryRelativePath.js"
import { GLOBAL_BUNDLING_TEST_GENERATE_PARAM } from "../global-bundling-test-param.js"

const testDirectoryRelativePath = importMetaUrlToDirectoryRelativePath(import.meta.url)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const bundleDirectoryRelativePath = `${testDirectoryRelativePath}dist/commonjs/`
const mainFileBasename = `${testDirectoryBasename}.js`

try {
  await generateGlobalBundle({
    ...GLOBAL_BUNDLING_TEST_GENERATE_PARAM,
    bundleDirectoryRelativePath,
    entryPointMap: {
      main: `${testDirectoryRelativePath}${mainFileBasename}`,
    },
  })
} catch (actual) {
  const expected = new Error(
    "UMD and IIFE output formats are not supported for code-splitting builds.",
  )
  expected.code = "INVALID_OPTION"
  assert({ actual, expected })
}
