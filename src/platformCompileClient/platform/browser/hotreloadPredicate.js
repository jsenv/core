import { fileToRemoteCompiledFile } from "./server.js"
import { isFileImported } from "../importTracker.js"

// we can be notified from file we don't care about, reload only if needed
export const hotreloadPredicate = (file) => {
  // isFileImported is useful in case the file was imported but is not
  // in System registry because it has a parse error or insantiate error
  if (isFileImported(file)) {
    return true
  }

  const remoteCompiledFile = fileToRemoteCompiledFile(file)
  return Boolean(window.System.get(remoteCompiledFile))
}
