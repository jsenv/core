import { fileToRemoteSourceFile, fileToRemoteCompiledFile } from "./server.js"
import { markFileAsImported } from "../importTracker.js"
import { rejectionValueToMeta } from "./rejectionValueToMeta.js"

export const executeFile = (file) => {
  markFileAsImported(file)

  const remoteCompiledFile = fileToRemoteCompiledFile(file)

  return window.System.import(remoteCompiledFile).catch((error) => {
    const meta = rejectionValueToMeta(error)

    document.body.innerHTML = `<h1><a href="${fileToRemoteSourceFile(
      file,
    )}">${file}</a> import rejected</h1>
	<pre style="border: 1px solid black">${meta.data}</pre>`

    return Promise.reject(error)
  })
}
