import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { bundleBrowser } from "../../../index.js"
import { importBrowserBundle } from "../import-browser-bundle.js"

const projectPath = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/browser`
const fileRelativePath = `${folderJsenvRelativePath}/balancing.js`

await bundleBrowser({
  projectPath,
  bundleIntoRelativePath,
  entryPointMap: {
    main: fileRelativePath,
  },
  compileGroupCount: 2,
  logLevel: "off",
})

const { namespace: actual } = await importBrowserBundle({
  projectPath,
  bundleIntoRelativePath,
  mainRelativePath: "/main.js",
})
const expected = { default: 42 }
assert({ actual, expected })
