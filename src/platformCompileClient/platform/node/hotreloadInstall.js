import "./EventSource-global.js"
import { processTeardown } from "../../../openServer/processTeardown.js"
import { sendToParent } from "./sendToParent.js"
import { isFileImported } from "../importTracker.js"

export const hotReloadInstall = ({ HOTRELOAD_SSE_ROOT }) => {
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

  const eventSource = new global.EventSource(HOTRELOAD_SSE_ROOT, {
    https: { rejectUnauthorized: false },
  })

  eventSource.addEventListener("file-changed", (e) => {
    if (e.origin !== HOTRELOAD_SSE_ROOT) {
      return
    }
    const fileChanged = e.data
    if (hotreloadPredicate(fileChanged)) {
      sendToParent("restart", { fileChanged })
    }
  })

  // by listening processTeardown we indirectly
  // do something like process.on('SIGINT', () => process.exit())
  processTeardown(() => {
    eventSource.close()
  })
}
