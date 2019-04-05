/* eslint-disable */
import { compileInto, compileServerOrigin, filenameRelative } from "\0self-import-options"
/* eslint-enable */
import "../../../node_modules/systemjs/dist/system.js"
// eslint-disable-next-line import/no-unresolved
import { executeCompiledFile } from "../../platform/browser/browserPlatform.js"

executeCompiledFile({
  compileInto,
  compileServerOrigin,
  filenameRelative,
})
