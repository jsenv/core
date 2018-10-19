import { systemInstall } from "./systemInstall.js"
import { hotReloadInstall } from "./hotreloadInstall.js"
import { executeFile } from "./executeFile.js"
import { forceEnumerable } from "./forceEnumerable.js"
import { sendToParent } from "./sendToParent.js"
import { platformToCompileId } from "../platformToCompileId.js"

process.on("message", ({ type, data }) => {
  if (type === "exit-please") {
    process.emit("SIGINT")
  }

  if (type === "execute") {
    const {
      // SOURCE_ROOT,
      LOCAL_SOURCE_ROOT,
      COMPILE_ORIGIN,
      COMPILE_INTO,
      COMPAT_MAP,
      COMPAT_MAP_DEFAULT_ID,
      HOTRELOAD,
      HOTRELOAD_SSE_ROOT,
      FILE,
    } = data

    const COMPILE_ID = platformToCompileId({
      compatMap: COMPAT_MAP,
      defaultId: COMPAT_MAP_DEFAULT_ID,
      platformName: "node",
      platforVersion: process.version.slice(1),
    })

    const COMPILE_ROOT = `${COMPILE_ORIGIN}/${COMPILE_INTO}/${COMPILE_ID}`

    const LOCAL_COMPILE_ROOT = `${LOCAL_SOURCE_ROOT}/${COMPILE_INTO}/${COMPILE_ID}`

    const fileToRemoteCompiledFile = (file) => `${COMPILE_ROOT}/${file}`

    const isRemoteCompiledFile = (string) => string.startsWith(COMPILE_ROOT)

    const remoteCompiledFileToFile = (remoteCompiledFile) =>
      remoteCompiledFile.slice(COMPILE_ROOT.length)

    const remoteCompiledFileToLocalCompiledFile = (remoteCompiledFile) =>
      `${LOCAL_COMPILE_ROOT}/${remoteCompiledFileToFile(remoteCompiledFile)}`

    if (HOTRELOAD) {
      hotReloadInstall({ HOTRELOAD_SSE_ROOT })
    }

    systemInstall({ isRemoteCompiledFile, remoteCompiledFileToLocalCompiledFile })

    executeFile({ file: FILE, remoteCompiledFile: fileToRemoteCompiledFile(FILE) }).then(
      (value) => {
        sendToParent("execute-result", {
          code: 0,
          value,
        })
      },
      (reason) => {
        // process.send algorithm does not send non enumerable values
        // but for error.message, error.stack we would like to get them
        // se we force all object properties to be enumerable
        // we could use @dmail/uneval here instead, for now let's keep it simple
        sendToParent("execute-result", {
          code: 1,
          value: forceEnumerable(reason),
        })
      },
    )
  }
})
