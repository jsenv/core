import { assert } from "@dmail/assert"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { bundleNode } from "../../../index.js"
import { importNodeBundle } from "../import-node-bundle.js"

const projectPath = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/node`
const firstEntryRelativePath = `${folderJsenvRelativePath}/a.js`
const secondEntryRelativePath = `${folderJsenvRelativePath}/b.js`

await bundleNode({
  projectPath,
  bundleIntoRelativePath,
  entryPointMap: {
    a: firstEntryRelativePath,
    b: secondEntryRelativePath,
  },
  logLevel: "off",
})

{
  const { namespace: actual } = await importNodeBundle({
    projectPath,
    bundleIntoRelativePath,
    mainRelativePath: "/a.js",
  })
  const expected = "a-shared"
  assert({ actual, expected })
}
{
  const { namespace: actual } = await importNodeBundle({
    projectPath,
    bundleIntoRelativePath,
    mainRelativePath: "/b.js",
  })
  const expected = "b-shared"
  assert({ actual, expected })
}
