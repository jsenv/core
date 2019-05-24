import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { bundleNode } from "../../../index.js"
import { importNodeBundle } from "../import-node-bundle.js"

const projectPath = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/node`
const fileRelativePath = `${folderJsenvRelativePath}/without-balancing.js`

await bundleNode({
  projectPath,
  bundleIntoRelativePath,
  entryPointMap: {
    main: fileRelativePath,
  },
  logLevel: "off",
})

const { namespace: actual } = await importNodeBundle({
  projectPath,
  bundleIntoRelativePath,
  mainRelativePath: "/main.js",
})
const expected = 42
assert({ actual, expected })
