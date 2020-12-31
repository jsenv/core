import { basename } from "path"
// import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { buildProject } from "@jsenv/core"
import {
  GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  // BROWSER_IMPORT_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
// import { browserImportEsModuleBuild } from "@jsenv/core/test/browserImportEsModuleBuild.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const mainFilename = `${testDirectoryname}.js`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.js",
}

// if it does not throw, it means `@jsenv/core/helpers/babel/typeof/typeof.js` was
// properly resolved.
// It's possible because jsenv server returns a minimal importmap with @jsenv/core/* remapping
// even if the project has no importmap file.
await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  importMapFileRelativeUrl: "./not-found.importmap",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
})
