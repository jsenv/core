import { assert } from "@dmail/assert"
import { ROOT_FOLDER } from "../../../src/ROOT_FOLDER.js"
import { hrefToFolderJsenvRelative } from "../../../src/hrefToFolderJsenvRelative.js"
import { generateImportMapForProjectNodeModules, bundleBrowser } from "../../../index.js"
import { importBrowserBundle } from "../import-browser-bundle.js"

const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const projectFolder = `${ROOT_FOLDER}/${testFolderRelative}`
const bundleInto = `dist/browser`

await generateImportMapForProjectNodeModules({
  projectFolder,
  importMapFilenameRelative: `importMap.json`,
  logImportMapFilePath: false,
})

await bundleBrowser({
  projectFolder,
  into: bundleInto,
  entryPointMap: {
    main: "scoped-node-module.js",
  },
  compileGroupCount: 1,
  logLevel: "off",
})

const { namespace: actual } = await importBrowserBundle({
  bundleFolder: `${projectFolder}/${bundleInto}`,
  file: "main.js",
})
const expected = { default: 42 }
assert({ actual, expected })
