import { hrefToSourceHref } from "../locaters.js"
import { valueInstall } from "../valueInstall.js"
import { evalSource } from "./evalSource.js"
import { fileHrefToPathname } from "@jsenv/module-resolution"

export const moduleSourceToSystemRegisteredModule = (
  code,
  { sourceRootHref, compiledRootHref, href, platformSystem },
) => {
  // This filename is very important because it allows the engine (like vscode) to know
  // that the evaluated file is in fact on the filesystem
  // (very important for debugging and sourcenap resolution)
  const sourceHref = hrefToSourceHref(href, {
    sourceRootHref,
    compiledRootHref,
  })
  const sourcePathname = fileHrefToPathname(sourceHref)

  const uninstallSystemGlobal = valueInstall(global, "System", platformSystem)
  try {
    evalSource(code, sourcePathname)
  } finally {
    uninstallSystemGlobal()
  }

  return platformSystem.getRegister()
}
