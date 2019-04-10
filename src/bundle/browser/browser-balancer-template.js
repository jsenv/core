/* eslint-disable */
// eslint must be disabled because he doesn't like that we try to load
// something containing \0
import { entryPointName, groupMap } from "\0bundle-browser-options.js"
/* eslint-enable */
import { detect } from "../../platform/browser/browserDetect/index.js"
import { browserToCompileId } from "../../platform/browser/browserToCompileId.js"

window.System.register([], function(_export, _context) {
  "use strict"
  return {
    // eslint-disable-next-line object-shorthand
    execute: function() {
      const compileId = browserToCompileId(detect(), groupMap)
      const scriptSrc = `./${compileId}/${entryPointName}.js`

      return _context.import(scriptSrc).then((namespace) => {
        _export(namespace)
      })
    },
  }
})
