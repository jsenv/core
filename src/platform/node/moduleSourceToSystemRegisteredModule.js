import { hrefToPathname } from "@jsenv/module-resolution"
import { hrefToMeta } from "../hrefToMeta.js"
import { valueInstall } from "../valueInstall.js"
import { evalSource } from "./evalSource.js"

export const moduleSourceToSystemRegisteredModule = (
  code,
  { compileInto, sourceOrigin, compileServerOrigin, href, platformSystem },
) => {
  const meta = hrefToMeta(href, {
    compileInto,
    compileServerOrigin,
  })

  // This filename is very important because it allows the engine (like vscode) to know
  // that the evaluated file is in fact on the filesystem
  // (very important for debugging and sourcemap resolution)
  const filename =
    meta.type === "compile-server-compiled-file"
      ? hrefToPathname(`${sourceOrigin}/${compileInto}/${meta.compileId}/${meta.ressource}`)
      : href

  const uninstallSystemGlobal = valueInstall(global, "System", platformSystem)
  try {
    evalSource(code, filename)
  } finally {
    uninstallSystemGlobal()
  }

  return platformSystem.getRegister()
}
