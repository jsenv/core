import { injectHmrInEsmUrls } from "./hmr_injection_esm.js"

export const injectHmr = ({ contentType, moduleFormat, code, hmr }) => {
  if (contentType === "application/javascript") {
    if (moduleFormat === "esmodule") {
      return injectHmrInEsmUrls({
        code,
        hmr,
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
