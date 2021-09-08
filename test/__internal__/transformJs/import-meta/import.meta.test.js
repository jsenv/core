import { assert } from "@jsenv/assert"
import {
  resolveUrl,
  readFile,
  writeFile,
  urlToRelativeUrl,
  copyFileSystemNode,
  urlToBasename,
} from "@jsenv/filesystem"

import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { transformJs } from "@jsenv/core/src/internal/compiling/js-compilation-service/transformJs.js"
import { nodeImportEsModuleBuild } from "@jsenv/core/test/nodeImportEsModuleBuild.js"
import { TRANSFORM_JS_TEST_PARAMS } from "../TEST_PARAMS_TRANSFORM_JS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = urlToBasename(testDirectoryUrl)
const filename = `${testDirectoryname}.js`
const originalFileUrl = resolveUrl(`./${filename}`, testDirectoryUrl)
const originalFileContent = await readFile(originalFileUrl)
const importMetaEnvFileRelativeUrl = `${testDirectoryRelativeUrl}env.js`

// esmodule
{
  const transformResult = await transformJs({
    ...TRANSFORM_JS_TEST_PARAMS,
    moduleOutFormat: "esmodule",
    importMetaEnvFileRelativeUrl,
    code: originalFileContent,
    url: originalFileUrl,
  })
  const distFileUrl = resolveUrl("dist/file.js", testDirectoryUrl)
  const envDistFileUrl = resolveUrl("dist/env.js", testDirectoryUrl)
  await writeFile(distFileUrl, transformResult.code)
  await copyFileSystemNode({
    from: resolveUrl(importMetaEnvFileRelativeUrl, jsenvCoreDirectoryUrl),
    to: envDistFileUrl,
    overwrite: true,
  })
  const result = await nodeImportEsModuleBuild({
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    testDirectoryRelativeUrl,
    jsFileRelativeUrl: "dist/file.js",
  })
  const actual = result.namespace
  const expected = {
    meta: {
      // meta contains only url (what is provided by the runtime)
      url: distFileUrl,
    },
    url: distFileUrl,
    urlDestructured: distFileUrl,
  }
  assert({ actual, expected })
}
