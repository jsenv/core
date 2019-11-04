import { assert } from "@dmail/assert"
import { generateCommonJsBundle } from "../../../index.js"
import { importMetaUrlToDirectoryRelativePath } from "../../importMetaUrlToDirectoryRelativePath.js"
import { requireCommonJsBundle } from "../require-commonjs-bundle.js"
import {
  COMMONJS_BUNDLING_TEST_GENERATE_PARAM,
  COMMONJS_BUNDLING_TEST_REQUIRE_PARAM,
} from "../commonjs-bundling-test-param.js"

const testDirectoryRelativePath = importMetaUrlToDirectoryRelativePath(import.meta.url)
const bundleDirectoryRelativePath = `${testDirectoryRelativePath}dist/commonjs`
const firstEntryFileRelativePath = `${testDirectoryRelativePath}a.js`
const secondEntryFileRelativePath = `${testDirectoryRelativePath}b.js`

await generateCommonJsBundle({
  ...COMMONJS_BUNDLING_TEST_GENERATE_PARAM,
  bundleDirectoryRelativePath,
  entryPointMap: {
    a: firstEntryFileRelativePath,
    b: secondEntryFileRelativePath,
  },
})

{
  const { namespace: actual } = await requireCommonJsBundle({
    ...COMMONJS_BUNDLING_TEST_REQUIRE_PARAM,
    bundleDirectoryRelativePath,
    mainRelativePath: "./a.js",
  })
  const expected = "a-shared"
  assert({ actual, expected })
}
{
  const { namespace: actual } = await requireCommonJsBundle({
    ...COMMONJS_BUNDLING_TEST_REQUIRE_PARAM,
    bundleDirectoryRelativePath,
    mainRelativePath: "./b.js",
  })
  const expected = "b-shared"
  assert({ actual, expected })
}
