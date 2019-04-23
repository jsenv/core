// eslint-disable-next-line import/no-unresolved
import { compileInto, compileServerOrigin } from "BROWSING_DATA.js"

// we could also get filenameRelative from BROWSING_DATA.js
const filenameRelative = window.location.pathname

const { executeCompiledFile } = await import("/.jsenv-well-known/browser-client.js")
executeCompiledFile({
  compileInto,
  compileServerOrigin,
  filenameRelative,
})
