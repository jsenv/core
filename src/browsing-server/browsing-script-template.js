// eslint-disable-next-line import/no-unresolved
import { filenameRelative } from "BROWSING_DATA.js"

const [{ executeCompiledFile }, { compileInto, compileServerOrigin }] = await Promise.all([
  import("/.jsenv-well-known/browser-client.js"),
  import("/.jsenv-well-known/browsing-dynamic-data.js"),
])

executeCompiledFile({
  compileInto,
  compileServerOrigin,
  filenameRelative,
})
