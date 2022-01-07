/*
 * to update the index.es5.js.map
 * you can use getSourceMap from @jsenv/core/test/get_source_map.js
 */

import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
  urlToFilename,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  findNodeByTagName,
  getHtmlNodeAttributeByName,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { getJavaScriptSourceMappingUrl } from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import {
  GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { browserImportSystemJsBuild } from "@jsenv/core/test/browserImportSystemJsBuild.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `script_with_sourcemap.html`
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const test = async (params) => {
  const { projectBuildMappings } = await buildProject({
    ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
    // logLevel: "info",
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPoints: {
      [`./${testDirectoryRelativeUrl}${mainFilename}`]: "main.html",
    },
    ...params,
  })
  const scriptBuildRelativeUrl =
    projectBuildMappings[`${testDirectoryRelativeUrl}index.es5.js`]
  const sourcemapBuildRelativeUrl =
    projectBuildMappings[`${testDirectoryRelativeUrl}index.es5.js.map`]

  return {
    scriptBuildRelativeUrl,
    sourcemapBuildRelativeUrl,
  }
}

// without minification
{
  const { scriptBuildRelativeUrl, sourcemapBuildRelativeUrl } = await test()
  const sourcemapBuildUrl = resolveUrl(
    sourcemapBuildRelativeUrl,
    buildDirectoryUrl,
  )
  const scriptBuildUrl = resolveUrl(scriptBuildRelativeUrl, buildDirectoryUrl)
  const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
  const htmlString = await readFile(htmlBuildUrl)
  const scriptNode = findNodeByTagName(htmlString, "script")

  // script.src is correct
  {
    const srcAttribute = getHtmlNodeAttributeByName(scriptNode, "src")
    const actual = srcAttribute.value
    const expected = scriptBuildRelativeUrl
    assert({ actual, expected })
  }

  // sourcemap file is copied too
  {
    const scriptString = await readFile(scriptBuildUrl)
    const actual = getJavaScriptSourceMappingUrl(scriptString)
    const expected = urlToRelativeUrl(sourcemapBuildUrl, scriptBuildUrl)
    assert({ actual, expected })
  }

  // souremap file content
  {
    const sourcemapString = await readFile(sourcemapBuildUrl)
    const sourcemap = JSON.parse(sourcemapString)
    const actual = {
      file: sourcemap.file,
      sources: sourcemap.sources,
    }
    const expected = {
      file: urlToFilename(scriptBuildUrl),
      sources: ["../../../index.source.js"],
    }
    assert({ actual, expected })
  }

  // execution works
  {
    const { namespace } = await browserImportSystemJsBuild({
      ...IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
      testDirectoryRelativeUrl,
      codeToRunInBrowser: "window.whatever",
      mainRelativeUrl: `./${scriptBuildUrl}`,
      // debug: true,
    })
    const actual = namespace
    const expected = 42
    assert({ actual, expected })
  }
}

// with minification
{
  const { scriptBuildRelativeUrl, sourcemapBuildRelativeUrl } = await test({
    minify: true,
  })
  const sourcemapBuildUrl = resolveUrl(
    sourcemapBuildRelativeUrl,
    buildDirectoryUrl,
  )
  const scriptBuildUrl = resolveUrl(scriptBuildRelativeUrl, buildDirectoryUrl)

  // souremap file content
  {
    const sourcemapString = await readFile(sourcemapBuildUrl)
    const sourcemap = JSON.parse(sourcemapString)
    const actual = {
      file: sourcemap.file,
      sources: sourcemap.sources,
    }
    const expected = {
      file: urlToFilename(scriptBuildUrl),
      sources: ["../../../index.source.js"],
    }
    assert({ actual, expected })
  }
}
