import { assert } from "@dmail/assert"
import { ROOT_FOLDER } from "../../../src/ROOT_FOLDER.js"
import { hrefToFolderJsenvRelative } from "../../../src/hrefToFolderJsenvRelative.js"
import { bundleNode } from "../../../index.js"
import { importNodeBundle } from "../import-node-bundle.js"

const projectFolder = ROOT_FOLDER
const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const bundleInto = `${testFolderRelative}/dist/node`

await bundleNode({
  projectFolder,
  into: bundleInto,
  entryPointMap: {
    main: `${testFolderRelative}/without-balancing.js`,
  },
  throwUnhandled: false,
  logBundleFilePaths: false,
})

const { namespace: actual } = await importNodeBundle({
  bundleFolder: `${projectFolder}/${bundleInto}`,
  file: `main.js`,
})
const expected = 42
assert({ actual, expected })
