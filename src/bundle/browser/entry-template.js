// eslint-disable-next-line import/no-unresolved
import { compileMap, entryPointFile } from "bundle-browser-options"
import { detect } from "../../platform/browser/browserDetect/index.js"
import { browserToCompileId } from "../../platform/browser/browserToCompileId.js"

const compileId = browserToCompileId(detect(), compileMap)
const scriptSrc = `./${compileId}/${entryPointFile}`

// document.write force browser to wait for the script to load
// before doing anything else.
// it allows to use the library immediatly without having to wait for DOMContentLoaded
// it requires to escape the closing script tag
document.write(
  `<script type="text/javascript" charset="utf-8" crossOrigin="anonymous" src="${scriptSrc}">${"</script>"}`,
)
