import { assert } from "@dmail/assert"
import { operatingSystemPathToPathname } from "@jsenv/operating-system-path"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { bundleNode } from "../../../index.js"
import { importNodeBundle } from "../import-node-bundle.js"
import {
  NODE_BUNDLER_TEST_PARAM,
  NODE_BUNDLER_TEST_IMPORT_PARAM,
} from "../node-bundler-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/node`

await bundleNode({
  ...NODE_BUNDLER_TEST_PARAM,
  bundleIntoRelativePath,
  entryPointMap: {
    main: `${folderJsenvRelativePath}/import-meta-url.js`,
  },
  logLevel: "off",
})

const { namespace: actual } = await importNodeBundle({
  ...NODE_BUNDLER_TEST_IMPORT_PARAM,
  bundleIntoRelativePath,
})
const expected = `file://${operatingSystemPathToPathname(
  JSENV_PATH,
)}${bundleIntoRelativePath}/main.js`
assert({ actual, expected })
