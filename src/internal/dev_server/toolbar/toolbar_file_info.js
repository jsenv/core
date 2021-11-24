import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

const injectorSourceRelativeUrl =
  "./src/internal/dev_server/toolbar/toolbar.injector.js"
const injectorBuildRelativeUrl = "./jsenv_toolbar_injector.js"
const injectorBuildUrl = new URL(
  "./dist/jsenv_toolbar_injector.js",
  jsenvCoreDirectoryUrl,
).href
export const toolbarInjectorFileInfo = {
  sourceRelativeUrl: injectorSourceRelativeUrl,
  buildRelativeUrl: injectorBuildRelativeUrl,
  buildUrl: injectorBuildUrl,
}

const htmlSourceUrl = new URL(
  "./src/internal/dev_server/toolbar/toolbar.html",
  jsenvCoreDirectoryUrl,
).href
export const toolbarHtmlFileInfo = {
  sourceUrl: htmlSourceUrl,
}

const jsSourceRelativeUrl = "./src/internal/dev_server/toolbar/toolbar.main.js"
const jsBuildRelativeUrl = "./jsenv_toolbar.js"
const jsSourceUrl = new URL(
  "./src/internal/dev_server/toolbar/toolbar.main.js",
  jsenvCoreDirectoryUrl,
).href
const jsBuildUrl = new URL("./dist/jsenv_toolbar.js", jsenvCoreDirectoryUrl)
  .href
export const toolbarJsFileInfo = {
  sourceRelativeUrl: jsSourceRelativeUrl,
  buildRelativeUrl: jsBuildRelativeUrl,
  sourceUrl: jsSourceUrl,
  buildUrl: jsBuildUrl,
}
