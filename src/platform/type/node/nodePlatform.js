import { versionIsBelowOrEqual } from "@dmail/project-structure-compile-babel"
import { open } from "./hotreload.js"
import { createImportTracker } from "../createImportTracker.js"
import https from "https"
import fetch from "node-fetch"
import EventSource from "eventsource"
import { createNodeSystem } from "@dmail/module-loader"
import { valueInstall } from "./valueInstall.js"
import { createLocaters } from "../createLocaters.js"
import { cancellationNone } from "../../../cancel/index.js"

export const nodeVersionToGroupId = (version, groupMap) => {
  return Object.keys(groupMap).find((id) => {
    const { compatMap } = groupMap[id]
    if ("node" in compatMap === false) {
      return false
    }
    const versionForGroup = compatMap.node
    return versionIsBelowOrEqual(versionForGroup, version)
  })
}

export const createNodePlatform = ({
  localRoot,
  remoteRoot,
  compileInto,
  groupMap,
  hotreload,
  hotreloadSSERoot,
  hotreloadCallback,
}) => {
  const compileId = nodeVersionToGroupId(process.version.slice(1), groupMap) || "otherwise"

  const {
    fileToRemoteCompiledFile,
    fileToRemoteInstrumentedFile,
    hrefToLocalFile,
  } = createLocaters({
    localRoot,
    remoteRoot,
    compileInto,
    compileId,
  })

  const { markFileAsImported, isFileImported } = createImportTracker()

  const nodeSystem = createNodeSystem({
    urlToFilename: (url) => {
      return hrefToLocalFile(url)
    },
  })

  const cleanupCallbacks = []

  cleanupCallbacks.push(valueInstall(https.globalAgent.options, "rejectUnauthorized", false))
  cleanupCallbacks.push(valueInstall(global, "fetch", fetch))
  cleanupCallbacks.push(valueInstall(global, "System", nodeSystem))
  cleanupCallbacks.push(valueInstall(global, "EventSource", EventSource))

  if (hotreload) {
    // we can be notified from file we don't care about, reload only if needed
    const hotreloadPredicate = (file) => {
      // isFileImported is useful in case the file was imported but is not
      // in System registry because it has a parse error or insantiate error
      if (isFileImported(file)) {
        return true
      }

      const remoteCompiledFile = fileToRemoteCompiledFile(file)
      if (global.System.get(remoteCompiledFile)) {
        return true
      }

      const remoteInstrumentedFile = fileToRemoteInstrumentedFile(file)
      if (global.System.get(remoteInstrumentedFile)) {
        return true
      }

      return false
    }

    cleanupCallbacks.push(
      open(hotreloadSSERoot, (fileChanged) => {
        if (hotreloadPredicate(fileChanged)) {
          hotreloadCallback({ file: fileChanged })
        }
      }),
    )
  }

  const close = () => {
    cleanupCallbacks.forEach((callback) => callback())
  }

  const executeFile = ({
    cancellation = cancellationNone,
    file,
    instrument = false,
    setup = () => {},
    teardown = () => {},
  }) => {
    return cancellation.wrap(() => {
      markFileAsImported(file)

      const fileURL = instrument
        ? fileToRemoteInstrumentedFile(file)
        : fileToRemoteCompiledFile(file)

      return Promise.resolve()
        .then(setup)
        .then(() => global.System.import(fileURL))
        .then(teardown)
    })
  }

  return { executeFile, close }
}
