import { generateImportMapForProjectNodeModules } from "@jsenv/node-module-import-map"
import { assert } from "@dmail/assert"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { bundleBrowser } from "../../../index.js"
import { importBrowserBundle } from "../import-browser-bundle.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const projectFolder = JSENV_PATH
const bundleInto = `${folderJsenvRelativePath}/dist/browser`

await generateImportMapForProjectNodeModules({
  projectFolder,
  importMapRelativePathnameRelative: `importMap.json`,
  logImportMapFilePath: false,
})

await bundleBrowser({
  projectFolder,
  into: bundleInto,
  entryPointMap: {
    main: `${folderJsenvRelativePath}/shared-node-module.js`,
  },
  logLevel: "off",
})

const { namespace: actual } = await importBrowserBundle({
  bundleFolder: `${projectFolder}/${bundleInto}`,
  file: "main.js",
})
const expected = { default: 42 }
assert({ actual, expected })
