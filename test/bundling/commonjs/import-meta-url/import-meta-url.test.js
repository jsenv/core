import { assert } from "@dmail/assert"
import { operatingSystemPathToPathname } from "@jsenv/operating-system-path"
import { importMetaURLToFolderJsenvRelativePath } from "../../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../../../src/JSENV_PATH.js"
import { generateCommonJsBundle } from "../../../../index.js"
import { requireCommonJsBundle } from "../require-commonjs-bundle.js"
import {
  COMMONJS_BUNDLING_TEST_GENERATE_PARAM,
  COMMONJS_BUNDLING_TEST_REQUIRE_PARAM,
} from "../commonjs-bundling-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/commonjs`

await generateCommonJsBundle({
  ...COMMONJS_BUNDLING_TEST_GENERATE_PARAM,
  bundleIntoRelativePath,
  entryPointMap: {
    main: `${folderJsenvRelativePath}/import-meta-url.js`,
  },
  logLevel: "off",
})

const { namespace: actual } = await requireCommonJsBundle({
  ...COMMONJS_BUNDLING_TEST_REQUIRE_PARAM,
  bundleIntoRelativePath,
})
const expected = `file://${operatingSystemPathToPathname(
  JSENV_PATH,
)}${bundleIntoRelativePath}/main.js`
assert({ actual, expected })
