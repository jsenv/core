import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { bundleNode } from "../../../index.js"
import { importNodeBundle } from "../import-node-bundle.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const projectFolder = JSENV_PATH
const bundleInto = `${folderJsenvRelativePath}/dist/node`

await bundleNode({
  projectFolder,
  into: bundleInto,
  entryPointMap: {
    main: `${folderJsenvRelativePath}/json.js`,
  },
  logLevel: "off",
})

const { namespace: actual } = await importNodeBundle({
  bundleFolder: `${projectFolder}/${bundleInto}`,
  file: `main.js`,
})
const expected = { foo: true }
assert({ actual, expected })
