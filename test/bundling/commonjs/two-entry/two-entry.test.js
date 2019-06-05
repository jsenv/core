import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { generateCommonJsBundle } from "../../../../index.js"
import { requireCommonJsBundle } from "../require-commonjs-bundle.js"
import {
  NODE_BUNDLER_TEST_PARAM,
  NODE_BUNDLER_TEST_IMPORT_PARAM,
} from "../node-bundler-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/commonjs`
const firstEntryRelativePath = `${folderJsenvRelativePath}/a.js`
const secondEntryRelativePath = `${folderJsenvRelativePath}/b.js`

await generateCommonJsBundle({
  ...NODE_BUNDLER_TEST_PARAM,
  bundleIntoRelativePath,
  entryPointMap: {
    a: firstEntryRelativePath,
    b: secondEntryRelativePath,
  },
})

{
  const { namespace: actual } = await requireCommonJsBundle({
    ...NODE_BUNDLER_TEST_IMPORT_PARAM,
    bundleIntoRelativePath,
    mainRelativePath: "/a.js",
  })
  const expected = "a-shared"
  assert({ actual, expected })
}
{
  const { namespace: actual } = await requireCommonJsBundle({
    ...NODE_BUNDLER_TEST_IMPORT_PARAM,
    bundleIntoRelativePath,
    mainRelativePath: "/b.js",
  })
  const expected = "b-shared"
  assert({ actual, expected })
}
