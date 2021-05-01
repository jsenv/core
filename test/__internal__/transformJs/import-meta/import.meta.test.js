import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, readFile, writeFile, urlToRelativeUrl, copyFileSystemNode } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { transformJs } from "@jsenv/core/src/internal/compiling/js-compilation-service/transformJs.js"
import { TRANSFORM_JS_TEST_PARAMS } from "../TEST_PARAMS_TRANSFORM_JS.js"
import { nodeImportEsModuleBuild } from "@jsenv/core/test/nodeImportEsModuleBuild.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryUrl)
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
    importMeta: { dev: true },
    code: originalFileContent,
    url: originalFileUrl,
  })
  const distFileUrl = resolveUrl("dist/file.js", testDirectoryUrl)
  const envDistFileUrl = resolveUrl("dist/env.js", testDirectoryUrl)
  await writeFile(distFileUrl, transformResult.code)
  await copyFileSystemNode(
    resolveUrl(importMetaEnvFileRelativeUrl, jsenvCoreDirectoryUrl),
    envDistFileUrl,
    { overwrite: true },
  )
  const result = await nodeImportEsModuleBuild({
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    testDirectoryRelativeUrl,
    mainRelativeUrl: "dist/file.js",
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
