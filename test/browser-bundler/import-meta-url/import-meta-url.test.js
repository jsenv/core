import { assert } from "@dmail/assert"
import { hrefToFolderJsenvRelative } from "../../../src/hrefToFolderJsenvRelative.js"
import { ROOT_FOLDER } from "../../../src/ROOT_FOLDER.js"
import { bundleBrowser } from "../../../index.js"
import { importBrowserBundle } from "../import-browser-bundle.js"

const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const projectFolder = `${ROOT_FOLDER}/${testFolderRelative}`
const bundleInto = `dist/browser`

await bundleBrowser({
  projectFolder,
  into: bundleInto,
  entryPointMap: {
    main: "import-meta-url.js",
  },
  logLevel: "off",
})
const { namespace: actual, serverOrigin } = await importBrowserBundle({
  bundleFolder: `${projectFolder}/${bundleInto}`,
  file: "main.js",
})
const expected = { default: `${serverOrigin}/main.js` }
assert({ actual, expected })
