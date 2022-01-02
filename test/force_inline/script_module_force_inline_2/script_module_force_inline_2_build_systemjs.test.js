import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  readFile,
  resolveUrl,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  findHtmlNodeById,
  getHtmlNodeAttributeByName,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
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
const mainFilename = `main.html`
const { buildMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "main.html",
  },
  systemJsName: "toto",
  // minify: true,
})
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
const htmlString = await readFile(htmlBuildUrl)

// systemjs is inlined (no http request needed)
{
  const systemJsScript = findHtmlNodeById(htmlString, "jsenv_inject_systemjs")
  const srcAttribute = getHtmlNodeAttributeByName(systemJsScript, "src")

  const actual = srcAttribute
  const expected = undefined
  assert({ actual, expected })
}

// importmap is inlined
{
  const importmapScript = findHtmlNodeById(htmlString, "importmap")
  const srcAttribute = getHtmlNodeAttributeByName(importmapScript, "src")
  const textNode = getHtmlNodeTextNode(importmapScript)

  const actual = {
    srcAttribute,
    mappings: JSON.parse(textNode.value),
  }
  const expected = {
    srcAttribute: undefined,
    mappings: {
      imports: {
        "./file.js": `./${buildMappings[`${testDirectoryRelativeUrl}file.js`]}`,
        "./main.js": `./main-d480b852.js`, // should not here because was inlined but that's ok
      },
    },
  }
  assert({ actual, expected })
}

// file executes properly
{
  const { namespace } = await browserImportSystemJsBuild({
    ...IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    codeToRunInBrowser: `(async () => {
  await new Promise(resolve => {
    setTimeout(resolve, 500)
  })

  return {
    hello: window.hello,
    answer: window.answer
  }
})()`,
    // debug: true,
  })
  const actual = namespace
  const expected = {
    hello: true,
    answer: 42,
  }
  assert({ actual, expected })
}
