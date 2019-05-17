import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { bundleNode } from "../../../index.js"
import { importNodeBundle } from "../import-node-bundle.js"

const projectFolder = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/node`

await bundleNode({
  projectFolder,
  bundleIntoRelativePath,
  entryPointMap: {
    main: `${folderJsenvRelativePath}/native-import.js`,
  },
  logLevel: "off",
})

const { namespace: actual } = await importNodeBundle({
  bundleFolder: `${projectFolder}${bundleIntoRelativePath}`,
  file: `main.js`,
})
const expected = "function"
assert({ actual, expected })
