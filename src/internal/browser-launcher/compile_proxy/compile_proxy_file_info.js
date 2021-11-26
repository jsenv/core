import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

const htmlSourceUrl = new URL(
  "./src/internal/browser-launcher/compile_proxy/compile_proxy.html",
  jsenvCoreDirectoryUrl,
).href
export const compileProxyHtmlFileInfo = {
  sourceUrl: htmlSourceUrl,
}

const jsSourceRelativeUrl =
  "./src/internal/browser-launcher/compile_proxy/compile_proxy.js"
const jsBuildRelativeUrl = "./jsenv_compile_proxy.js"
const jsSourceUrl = new URL(jsSourceRelativeUrl, jsenvCoreDirectoryUrl).href
const jsBuildUrl = new URL(
  "./dist/jsenv_compile_proxy.js",
  jsenvCoreDirectoryUrl,
)
export const compileProxyJsFileInfo = {
  sourceRelativeUrl: jsSourceRelativeUrl,
  buildRelativeUrl: jsBuildRelativeUrl,
  sourceUrl: jsSourceUrl,
  buildUrl: jsBuildUrl,
}
