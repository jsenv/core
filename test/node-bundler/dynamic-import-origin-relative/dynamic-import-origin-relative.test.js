import { assert } from "@dmail/assert"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { bundleNode } from "../../../index.js"
import { importNodeBundle } from "../import-node-bundle.js"

const projectFolder = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/node`
const fileRelativePath = `${folderJsenvRelativePath}/dynamic-import-origin-relative.js`

await bundleNode({
  projectFolder,
  bundleIntoRelativePath,
  entryPointMap: {
    main: fileRelativePath,
  },
  logLevel: "off",
})

const { namespace } = await importNodeBundle({
  bundleFolder: `${projectFolder}${bundleIntoRelativePath}`,
  file: "main.js",
})
const actual = await namespace
const expected = { default: 42 }
assert({ actual, expected })
