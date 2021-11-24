/*
 * auto redirection to a compile group depending on browser capabilities
 */

import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

const htmlSourceUrl = new URL(
  "./src/internal/dev_server/redirector/redirector.html",
  jsenvCoreDirectoryUrl,
).href
export const redirectorHtmlFileInfo = {
  sourceUrl: htmlSourceUrl,
}

const jsSourceRelativeUrl = "./src/internal/dev_server/redirector/redirector.js"
const jsBuildRelativeUrl = "./jsenv_redirector.js"
const jsSourceUrl = new URL(jsSourceRelativeUrl, jsenvCoreDirectoryUrl).href
const jsBuildUrl = new URL("./dist/jsenv_redirector.js", jsenvCoreDirectoryUrl)
export const redirectorJsFileInfo = {
  sourceRelativeUrl: jsSourceRelativeUrl,
  buildRelativeUrl: jsBuildRelativeUrl,
  sourceUrl: jsSourceUrl,
  buildUrl: jsBuildUrl,
}
