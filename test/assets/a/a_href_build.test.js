import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  readFile,
  resolveUrl,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import {
  findHtmlNodeById,
  getHtmlNodeAttributeByName,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { executeInBrowser } from "@jsenv/core/test/execute_in_browser.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const mainFilename = `main.html`
const { buildMappings } = await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "main.html",
  },
})
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
const htmlString = await readFile(htmlBuildUrl)
const readAHref = (id) => {
  const a = findHtmlNodeById(htmlString, id)
  return getHtmlNodeAttributeByName(a, "href").value
}
const htmlHref = readAHref("a_html")
const anchorHref = readAHref("a_anchor")
const httpsHref = readAHref("a_https")
const downloadHref = readAHref("a_download")
const aboutBlankHref = readAHref("a_about_blank")
const mailtoHref = readAHref("a_mailto")
const telHref = readAHref("a_tel")
const actual = {
  htmlHref,
  anchorHref,
  httpsHref,
  downloadHref,
  aboutBlankHref,
  mailtoHref,
  telHref,
}
const expected = {
  htmlHref: "page.html",
  anchorHref: "#title",
  httpsHref: "https://example.com",
  downloadHref: "assets/file_64ec88ca.txt",
  aboutBlankHref: "about:blank",
  mailtoHref: "mailto:m.bluth@example.com",
  telHref: "tel:+123456789",
}
assert({ actual, expected })

const jsBuildRelativeUrl = buildMappings[`${testDirectoryRelativeUrl}main.js`]
{
  const { returnValue } = await executeInBrowser({
    directoryUrl: new URL("./", import.meta.url),
    htmlFileRelativeUrl: "./dist/esmodule/main.html",
    /* eslint-disable no-undef */
    pageFunction: async (jsBuildRelativeUrl) => {
      const namespace = await import(jsBuildRelativeUrl)
      return namespace
    },
    /* eslint-enable no-undef */
    pageArguments: [`./${jsBuildRelativeUrl}`],
  })
  const actual = returnValue
  const expected = { answer: 42 }
  assert({ actual, expected })
}
{
  const { returnValue } = await executeInBrowser({
    directoryUrl: new URL("./", import.meta.url),
    htmlFileRelativeUrl: "./dist/esmodule/page.html",
    /* eslint-disable no-undef */
    pageFunction: async (jsBuildRelativeUrl) => {
      const namespace = await import(jsBuildRelativeUrl)
      return namespace
    },
    /* eslint-enable no-undef */
    pageArguments: [`./${jsBuildRelativeUrl}`],
  })
  const actual = returnValue
  const expected = { answer: 42 }
  assert({ actual, expected })
}
