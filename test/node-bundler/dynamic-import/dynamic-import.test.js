import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { bundleNode } from "../../../index.js"
import { importNodeBundle } from "../import-node-bundle.js"

const projectPath = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/node`

await bundleNode({
  projectPath,
  bundleIntoRelativePath,
  entryPointMap: {
    main: `${folderJsenvRelativePath}/dynamic-import.js`,
  },
  logLevel: "off",
})

const { namespace } = await importNodeBundle({
  bundleFolder: `${projectPath}${bundleIntoRelativePath}`,
  file: "main.js",
})
const actual = await namespace
const expected = { default: 42 }
assert({ actual, expected })
