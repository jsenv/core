import { createLocaters } from "../createLocaters.js"
import { nodeToCompileId } from "./nodeToCompileId.js"
import { createPlatformHooks } from "./createPlatformHooksUsingSystem.js"
import { fetchSource } from "./fetchSource.js"

const onExecuteError = (error, { file, fileToLocalFile }) => {
  if (error && error.code === "MODULE_PARSE_ERROR") {
    error.message = error.message.replace(file, fileToLocalFile(file))
    throw error
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
  const platformHooks = createPlatformHooks({
    fetchSource,
    hrefToLocalFile,
    fileToRemoteCompiledFile,
  })

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
