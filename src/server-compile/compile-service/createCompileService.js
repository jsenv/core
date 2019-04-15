import { createCancellationToken } from "@dmail/cancellation"
import { acceptContentType, createSSERoom, serviceCompose } from "../../server/index.js"
import { watchFile } from "../../watchFile.js"
import { locate as locateDefault } from "./locate.js"
import { compileRequestToResponse } from "../compile-request-to-response/index.js"

export const createCompileService = async ({
  cancellationToken = createCancellationToken(),
  projectFolder,
  compileInto,
  locate = locateDefault,
  watchSource,
  watchSourcePredicate,
  clientCompileCacheStrategy,
  serverCompileCacheStrategy,
  serverCompileCacheTrackHit,
  enableGlobalLock,
  compileImportMap,
  compileJs,
}) => {
  const { registerFileChangedCallback, triggerFileChanged } = createFileChangedSignal()

  const watchedFiles = new Map()
  cancellationToken.register(() => {
    watchedFiles.forEach((closeWatcher) => closeWatcher())
    watchedFiles.clear()
  })

  const compileService = async ({ origin, ressource, method, headers = {} }) => {
    const requestPathname = ressource

    if (pathnameIsAsset(ressource)) return null

    const { compileId, filename } = await locate({
      projectFolder,
      compileInto,
      requestPathname,
    })

    // cannot locate a file -> we don't know what to compile
    if (!compileId) return null

    // we don't want to read anything outside of the project
    if (fileIsOutsideFolder(filename, projectFolder)) {
      return { status: 403, statusText: `cannot access file outside project` }
    }

    const filenameRelative = filename.slice(projectFolder.length + 1)
    const expectedFilenameRelative = ressource.slice(`/${compileInto}/${compileId}/`.length)
    // a request to 'node_modules/dependency/index.js'
    // with referer 'node_modules/package/index.js'
    // may be found at 'node_modules/package/node_modules/dependency/index.js'
    if (filenameRelative !== expectedFilenameRelative) {
      // in that case, send temporary redirect to client
      return {
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/307
        status: 307,
        headers: {
          location: `${origin}/${filenameRelative}`,
        },
      }
    }

    let compile
    if (filenameRelative === "importMap.json") {
      compile = compileImportMap
    } else {
      compile = compileJs
    }

    // we are asking for a compiled version of a file that does not have to be compiled
    // we can redirect to the non compiled version
    if (!compile) {
      return {
        status: 307,
        headers: {
          location: `${origin}/${filenameRelative}`,
        },
      }
    }

    // when I ask for a compiled file, watch the corresponding file on filesystem
    if (
      watchSource &&
      watchedFiles.has(filename) === false &&
      watchSourcePredicate(filenameRelative)
    ) {
      const fileWatcher = watchFile(filename, () => {
        triggerFileChanged({ filename, filenameRelative })
      })
      watchedFiles.set(filename, fileWatcher)
    }

    return compileRequestToResponse({
      projectFolder,
      compileInto,
      compileId,
      clientCompileCacheStrategy,
      serverCompileCacheStrategy,
      serverCompileCacheTrackHit,
      enableGlobalLock,
      method,
      headers,
      filenameRelative,
      filename,
      compile,
    })
  }

  const createWatchSSEService = () => {
    const fileChangedSSE = createSSERoom()

    fileChangedSSE.open()
    cancellationToken.register(fileChangedSSE.close)

    registerFileChangedCallback(({ filenameRelative }) => {
      fileChangedSSE.sendEvent({
        type: "file-changed",
        data: filenameRelative,
      })
    })

    return ({ headers }) => {
      if (acceptContentType(headers.accept, "text/event-stream")) {
        return fileChangedSSE.connect(headers["last-event-id"])
      }
      return null
    }
  }

  if (watchSource) {
    return serviceCompose(createWatchSSEService(), compileService)
  }

  return compileService
}

const createFileChangedSignal = () => {
  const fileChangedCallbackArray = []

  const registerFileChangedCallback = (callback) => {
    fileChangedCallbackArray.push(callback)
  }

  const changed = (data) => {
    const callbackArray = fileChangedCallbackArray.slice()
    callbackArray.forEach((callback) => {
      callback(data)
    })
  }

  return { registerFileChangedCallback, changed }
}

const pathnameIsAsset = (pathname) => pathname.match(/[^\/]+__asset__\/.+$/)

const fileIsInsideFolder = (filename, folder) => filename.startsWith(`${folder}/`)

const fileIsOutsideFolder = (filename, folder) => !fileIsInsideFolder(filename, folder)
