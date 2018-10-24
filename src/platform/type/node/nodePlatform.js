import { open } from "./hotreload.js"
import { install } from "./system.js"
import { platformToCompileId } from "../platformToCompileId.js"
import { createImportTracker } from "../createImportTracker.js"

export const createNodePlatform = ({
  localRoot,
  remoteRoot,
  compileInto,
  compatMap,
  compatMapDefaultId,
  hotreload,
  hotreloadSSERoot,
  hotreloadCallback,
}) => {
  const compileId = platformToCompileId({
    compatMap,
    defaultId: compatMapDefaultId,
    platformName: "node",
    platforVersion: process.version.slice(1),
  })

  const localCompileRoot = `${localRoot}/${compileInto}/${compileId}`

  const remoteCompileRoot = `${remoteRoot}/${compileInto}/${compileId}`

  const fileToRemoteCompiledFile = (file) => `${remoteCompileRoot}/${file}`

  const fileToRemoteSourceFile = (file) => `${remoteRoot}/${file}`

  const isRemoteCompiledFile = (string) => string.startsWith(remoteCompileRoot)

  const remoteCompiledFileToFile = (remoteCompiledFile) =>
    remoteCompiledFile.slice(remoteCompileRoot.length)

  const remoteCompiledFileToLocalCompiledFile = (remoteCompiledFile) =>
    `${localCompileRoot}/${remoteCompiledFileToFile(remoteCompiledFile)}`

  const { markFileAsImported, isFileImported } = createImportTracker()

  const context = {
    fileToRemoteCompiledFile,
    fileToRemoteSourceFile,
    isRemoteCompiledFile,
    remoteCompiledFileToFile,
    remoteCompiledFileToLocalCompiledFile,
    isFileImported,
    markFileAsImported,
  }

  install(context)

  if (hotreload) {
    // we can be notified from file we don't care about, reload only if needed
    const hotreloadPredicate = (file) => {
      // isFileImported is useful in case the file was imported but is not
      // in System registry because it has a parse error or insantiate error
      if (isFileImported(file)) {
        return true
      }

      const remoteCompiledFile = file
      return Boolean(global.System.get(remoteCompiledFile))
    }

    open(hotreloadSSERoot, (fileChanged) => {
      if (hotreloadPredicate(fileChanged)) {
        hotreloadCallback({ file: fileChanged })
      }
    })
  }

  const executeFile = (file, setup = () => {}, teardown = () => {}) => {
    markFileAsImported(file)

    const remoteCompiledFile = fileToRemoteCompiledFile(file)

    return Promise.resolve()
      .then(setup)
      .then(() => global.System.import(remoteCompiledFile))
      .then(teardown)
  }

  return { executeFile }
}
