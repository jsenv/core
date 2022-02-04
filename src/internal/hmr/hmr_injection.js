import { injectHmrInJsModuleUrls } from "./hmr_injection_js_module.js"

export const injectHmr = ({
  projectDirectoryUrl,
  ressourceGraph,
  url,
  contentType,
  moduleFormat,
  code,
}) => {
  if (contentType === "application/javascript") {
    if (moduleFormat === "esmodule") {
      return injectHmrInJsModuleUrls({
        projectDirectoryUrl,
        ressourceGraph,
        url,
        code,
      })
    }
    return code
    // we could also support file written using systemjs
    // and replace the urls found in System.register and System.resolve calls
    // if moduleOutFormat === 'systemjs'){
    //
    // }
  }
  // TODO: CSS
  return code
}
