import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { browserImportEsModuleBuild } from "@jsenv/core/test/browserImportEsModuleBuild.js"
import {
  findHtmlNodeById,
  getHtmlNodeAttributeByName,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"

const { server } = await import("./script/serve.js")
try {
  const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
  const testDirectoryRelativeUrl = urlToRelativeUrl(
    testDirectoryUrl,
    jsenvCoreDirectoryUrl,
  )
  const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
  const entryPoints = {
    [`./${testDirectoryRelativeUrl}main.html`]: "main.html",
  }
  const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
  const buildDirectoryUrl = resolveUrl(
    buildDirectoryRelativeUrl,
    jsenvCoreDirectoryUrl,
  )
  const readScriptSrcAndWindowAnswer = async () => {
    const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
    const htmlString = await readFile(htmlBuildUrl)
    const scriptNode = findHtmlNodeById(htmlString, "script")
    const srcAttribute = getHtmlNodeAttributeByName(scriptNode, "src")
    const src = srcAttribute ? srcAttribute.value : ""
    const result = await browserImportEsModuleBuild({
      projectDirectoryUrl: jsenvCoreDirectoryUrl,
      testDirectoryRelativeUrl,
      /* eslint-disable no-undef */
      codeToRunInBrowser: async () => {
        return window.answer
      },
      /* eslint-enable no-undef */
    })
    return { src, windowAnswer: result.value }
  }

  // remote js fetched during build
  {
    await buildProject({
      ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
      // logLevel: "debug",
      jsenvDirectoryRelativeUrl,
      entryPoints,
      buildDirectoryRelativeUrl,
      format: "esmodule",
      preservedUrls: {
        "http://localhost:9999/": false,
      },
    })
    const { src, windowAnswer } = await readScriptSrcAndWindowAnswer()

    const actual = {
      src,
      windowAnswer,
    }
    const expected = {
      src: "assets/file_2ddb6eef.js",
      windowAnswer: 42,
    }
    assert({ actual, expected })
  }

  // remote js preserved
  {
    await buildProject({
      ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
      // logLevel: "debug",
      jsenvDirectoryRelativeUrl,
      entryPoints,
      buildDirectoryRelativeUrl,
      format: "esmodule",
    })
    const { src, windowAnswer } = await readScriptSrcAndWindowAnswer()

    const actual = {
      src,
      windowAnswer,
    }
    const expected = {
      src: `${server.origin}/file.js`,
      windowAnswer: 42,
    }
    assert({ actual, expected })
  }
} finally {
  server.stop()
}
