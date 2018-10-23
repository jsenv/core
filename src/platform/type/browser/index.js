import { createImportTracker } from "../createImportTracker.js"
import { createExecuteFile } from "./createExecuteFile.js"
import { parse } from "./userAgent.js"
import { platformToCompileId } from "../platformToCompileId.js"
import { open } from "./hotreload.js"

export default ({
  remoteRoot,
  compileInto,
  compatMap,
  compatMapDefaultId,
  hotreload = false,
  hotreloadSSERoot,
}) => {
  const browser = parse(window.navigator.userAgent)

  const compileId = platformToCompileId({
    compatMap,
    defaultId: compatMapDefaultId,
    platformName: browser.name,
    platformVersion: browser.version,
  })

  const compileRoot = `${remoteRoot}/${compileInto}/${compileId}`

  const fileToRemoteCompiledFile = (file) => `${compileRoot}/${file}`

  const fileToRemoteSourceFile = (file) => `${remoteRoot}/${file}`

  const isRemoteCompiledFile = (string) => string.startsWith(compileRoot)

  const remoteCompiledFileToFile = (remoteCompiledFile) =>
    remoteCompiledFile.slice(compileRoot.length)

  const { markFileAsImported, isFileImported } = createImportTracker()

  const context = {
    fileToRemoteCompiledFile,
    fileToRemoteSourceFile,
    isRemoteCompiledFile,
    remoteCompiledFileToFile,
    isFileImported,
    markFileAsImported,
  }

  if (hotreload) {
    const hotreloadPredicate = (file) => {
      // isFileImported is useful in case the file was imported but is not
      // in System registry because it has a parse error or insantiate error
      if (isFileImported(file)) {
        return true
      }

      const remoteCompiledFile = fileToRemoteCompiledFile(file)
      return Boolean(window.System.get(remoteCompiledFile))
    }

    open(hotreloadSSERoot, (file) => {
      if (hotreloadPredicate(file)) {
        // we cannot just System.delete the file because the change may have any impact, we have to reload
        window.location.reload()
      }
    })
  }

  const executeFile = createExecuteFile(context)

  return { executeFile }
}
