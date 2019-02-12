import { valueInstall } from "../valueInstall.js"
import { evalSource } from "./evalSource.js"

export const moduleSourceToSystemRegisteredModule = (code, { href, platformSystem }) => {
  const uninstallSystemGlobal = valueInstall(window, "System", platformSystem)
  try {
    evalSource(code, href)
  } finally {
    uninstallSystemGlobal()
  }

  return platformSystem.getRegister()
}
