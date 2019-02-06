import { valueInstall } from "../valueInstall.js"
import { evalSource } from "./evalSource.js"

export const moduleSourceToSystemRegisteredModule = (code, { remoteFile, platformSystem }) => {
  const uninstallSystemGlobal = valueInstall(window, "System", platformSystem)
  try {
    evalSource(code, remoteFile)
  } finally {
    uninstallSystemGlobal()
  }

  return platformSystem.getRegister()
}
