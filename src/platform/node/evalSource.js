import { Script } from "vm"
import { remoteFileToLocalSourceFile } from "../locaters.js"

export const evalSource = (code, { remoteFile, remoteRoot, localRoot }) => {
  const localFile = remoteFileToLocalSourceFile({
    file: remoteFile,
    localRoot,
    remoteRoot,
  })
  // This filename is very important because it allows the engine (like vscode) to know
  // that the evaluated file is in fact on the filesystem
  // (very important for debugging and sourcenap resolution)
  const script = new Script(code, { filename: localFile })
  return script.runInThisContext()
}
