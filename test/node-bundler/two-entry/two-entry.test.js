import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { bundleNode } from "../../../index.js"
import { importNodeBundle } from "../import-node-bundle.js"
import {
  NODE_BUNDLER_TEST_PARAM,
  NODE_BUNDLER_TEST_IMPORT_PARAM,
} from "../node-bundler-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/node`
const firstEntryRelativePath = `${folderJsenvRelativePath}/a.js`
const secondEntryRelativePath = `${folderJsenvRelativePath}/b.js`

await bundleNode({
  ...NODE_BUNDLER_TEST_PARAM,
  bundleIntoRelativePath,
  entryPointMap: {
    a: firstEntryRelativePath,
    b: secondEntryRelativePath,
  },
})

{
  const { namespace: actual } = await importNodeBundle({
    ...NODE_BUNDLER_TEST_IMPORT_PARAM,
    bundleIntoRelativePath,
    mainRelativePath: "/a.js",
  })
  const expected = "a-shared"
  assert({ actual, expected })
}
{
  const { namespace: actual } = await importNodeBundle({
    ...NODE_BUNDLER_TEST_IMPORT_PARAM,
    bundleIntoRelativePath,
    mainRelativePath: "/b.js",
  })
  const expected = "b-shared"
  assert({ actual, expected })
}
