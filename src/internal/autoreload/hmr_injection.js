import { injectHmrInJsModuleUrls } from "./hmr_injection_js_module.js"
import { injectHmrInCssUrls } from "./hmr_injection_css.js"

export const injectHmr = ({
  projectDirectoryUrl,
  sourceFileFetcher,
  ressourceGraph,
  url,
  contentType,
  moduleFormat,
  content,
}) => {
  if (contentType === "application/javascript") {
    if (moduleFormat === "esmodule") {
      return injectHmrInJsModuleUrls({
        projectDirectoryUrl,
        sourceFileFetcher,
        ressourceGraph,
        url,
        content,
      })
    }
    return content
    // we could also support file written using systemjs
    // and replace the urls found in System.register and System.resolve calls
    // if moduleOutFormat === 'systemjs'){
    //
    // }
  }
  if (contentType === "text/css") {
    return injectHmrInCssUrls({
      ressourceGraph,
      url,
      content,
    })
  }
  return content
}
