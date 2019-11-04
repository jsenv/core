import { basename } from "path"
import { assert } from "@dmail/assert"
import { generateSystemJsBundle } from "../../../index.js"
import { importMetaUrlToDirectoryRelativePath } from "../../importMetaUrlToDirectoryRelativePath.js"
import { nodeImportSystemJsBundle } from "../nodeImportSystemJsBundle.js"
import {
  SYSTEMJS_BUNDLING_TEST_GENERATE_PARAM,
  SYSTEMJS_BUNDLING_TEST_IMPORT_PARAM,
} from "../systemjs-bundling-test-param.js"

const testDirectoryRelativePath = importMetaUrlToDirectoryRelativePath(import.meta.url)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const bundleDirectoryRelativePath = `${testDirectoryRelativePath}dist/systemjs/`
const mainFileBasename = `${testDirectoryBasename}.js`

await generateSystemJsBundle({
  ...SYSTEMJS_BUNDLING_TEST_GENERATE_PARAM,
  bundleDirectoryRelativePath,
  entryPointMap: {
    main: `${testDirectoryRelativePath}${mainFileBasename}`,
  },
})
const { namespace: actual } = await nodeImportSystemJsBundle({
  ...SYSTEMJS_BUNDLING_TEST_IMPORT_PARAM,
  testDirectoryRelativePath,
})
const expected = {
  default: 42,
}
assert({ actual, expected })
