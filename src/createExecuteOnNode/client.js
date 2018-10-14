import { ensureSystem } from "./ensureSystem.js"
import { processCleanup } from "../openServer/processTeardown.js"
import "./global-fetch.js"
import "./global-EventSource.js"

const forceEnumerable = (value) => {
  if (value === undefined || value === null || typeof value !== "object") {
    return value
  }

  const enumerableValue = {}
  Object.getOwnPropertyNames(value).forEach((name) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, name)

    Object.defineProperty(enumerableValue, name, {
      ...descriptor,
      ...{ enumerable: true },
      ...(descriptor.hasOwnProperty("value") ? { value: forceEnumerable(descriptor.value) } : {}),
    })
  })

  return enumerableValue
}

process.on("message", ({ type, id, data }) => {
  if (type === "exit-please") {
    process.emit("SIGINT")
  }

  if (type === "execute") {
    const {
      localRoot,
      remoteRoot,
      remoteCompileDestination,
      file,
      setupSource,
      teardownSource,
      hotreload,
    } = data

    const remoteFile = `${remoteRoot}/${remoteCompileDestination}/${file}`

    const sendToParent = (type, data) => {
      process.send({
        id,
        type,
        data,
      })
    }

    Promise.resolve()
      .then(() => ensureSystem({ localRoot, remoteRoot }))
      .then((nodeSystem) => {
        let failedImportFile
        if (hotreload) {
          const eventSource = new global.EventSource(remoteRoot, {
            https: { rejectUnauthorized: false },
          })
          eventSource.addEventListener("file-changed", (e) => {
            if (e.origin !== remoteRoot) {
              return
            }
            const fileChanged = e.data
            const changedFileLocation = `${remoteRoot}/${remoteCompileDestination}/${fileChanged}`
            // we may be notified from file we don't care about, reload only if needed
            // we cannot just System.delete the file because the change may have any impact, we have to reload
            if (failedImportFile === fileChanged || nodeSystem.get(changedFileLocation)) {
              sendToParent("restart", { fileChanged })
            }
          })

          // by listening processCleanUp we indirectly
          // do something like process.on('SIGINT', () => process.exit())
          processCleanup(() => {
            eventSource.close()
          })
        }

        const setup = eval(setupSource)
        const teardown = eval(teardownSource)

        return Promise.resolve()
          .then(setup)
          .then(() => nodeSystem.import(remoteFile))
          .then(teardown)
      })
      .then(
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
