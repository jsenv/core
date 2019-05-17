import { assert } from "@dmail/assert"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { bundleBrowser } from "../../../index.js"
import { importBrowserBundle } from "../import-browser-bundle.js"

const projectFolder = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleInto = `${folderJsenvRelativePath}/dist/browser`

await bundleBrowser({
  projectFolder,
  into: bundleInto,
  entryPointMap: {
    main: `${folderJsenvRelativePath}/without-balancing.js`,
  },
  throwUnhandled: false,
  logLevel: "off",
})
const { namespace: actual } = await importBrowserBundle({
  bundleFolder: `${projectFolder}/${bundleInto}`,
  file: "main.js",
})
const expected = { default: 42 }
assert({ actual, expected })
