import { remoteFileToLocalSourceFile } from "../locaters.js"
import { valueInstall } from "../valueInstall.js"
import { evalSource } from "./evalSource.js"

export const moduleSourceToSystemRegisteredModule = (
  code,
  { localRoot, remoteRoot, remoteFile, platformSystem },
) => {
  // This filename is very important because it allows the engine (like vscode) to know
  // that the evaluated file is in fact on the filesystem
  // (very important for debugging and sourcenap resolution)
  const filename = remoteFileToLocalSourceFile(remoteFile, {
    localRoot,
    remoteRoot,
  })

  const uninstallSystemGlobal = valueInstall(global, "System", platformSystem)
  try {
    evalSource(code, filename)
  } finally {
    uninstallSystemGlobal()
  }

  return platformSystem.getRegister()
}
