import { createLocaters } from "../createLocaters.js"
import { nodeToCompileId } from "./nodeToCompileId.js"
import { createPlatformHooks } from "./createPlatformHooksUsingSystem.js"

const onExecuteError = (error, { file, fileToLocalFile }) => {
  if (error && error.status === 500 && error.reason === "parse error") {
    const data = JSON.parse(error.body)
    const parseError = new Error()
    Object.assign(parseError, data)
    parseError.message = data.message.replace(file, fileToLocalFile(file))
    throw parseError
  }
  if (error && error.code === "MODULE_INSTANTIATE_ERROR") {
    throw error.error
  }
  throw error
}

export const loadNodePlatform = ({ compileMap, localRoot, remoteRoot, compileInto }) => {
  const compileId =
    nodeToCompileId({ name: "node", version: process.version.slice(1) }, compileMap) || "otherwise"
  const {
    fileToRemoteCompiledFile,
    fileToRemoteInstrumentedFile,
    fileToLocalFile,
    hrefToLocalFile,
  } = createLocaters({
    localRoot,
    remoteRoot,
    compileInto,
    compileId,
  })
  const platformHooks = createPlatformHooks({ hrefToLocalFile, fileToRemoteCompiledFile })

  const executeFile = (file, { instrument = false } = {}) => {
    const remoteCompiledFile = instrument
      ? fileToRemoteCompiledFile(file)
      : fileToRemoteInstrumentedFile(file)

    return platformHooks.executeFile(remoteCompiledFile).catch((error) => {
      return onExecuteError(error, {
        file,
        fileToLocalFile,
      })
    })
  }

  return Promise.resolve({ executeFile })
}
