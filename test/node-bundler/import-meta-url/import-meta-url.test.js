import { assert } from "@dmail/assert"
import { operatingSystemPathToPathname } from "@jsenv/operating-system-path"
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
    main: `${folderJsenvRelativePath}/import-meta-url.js`,
  },
  logLevel: "off",
})

const { namespace: actual } = await importNodeBundle({
  projectPath,
  bundleIntoRelativePath,
  mainRelativePath: "/main.js",
})
const expected = `file://${operatingSystemPathToPathname(
  projectPath,
)}${bundleIntoRelativePath}/main.js`
assert({ actual, expected })
