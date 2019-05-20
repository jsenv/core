import { assert } from "@dmail/assert"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { bundleBrowser } from "../../../index.js"
import { importBrowserBundle } from "../import-browser-bundle.js"

const projectPath = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/browser`
const fileRelativePath = `${folderJsenvRelativePath}/origin-relative.js`

await bundleBrowser({
  projectPath,
  bundleIntoRelativePath,
  entryPointMap: {
    main: fileRelativePath,
  },
  logLevel: "off",
})

const { namespace: actual } = await importBrowserBundle({
  bundleFolder: `${projectPath}${bundleIntoRelativePath}`,
  file: "main.js",
})
const expected = { default: 42 }
assert({ actual, expected })
