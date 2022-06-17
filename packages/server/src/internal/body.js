import { Stream, Writable, Readable } from "node:stream"
import { createReadStream } from "node:fs"

import { isObservable, observableFromValue } from "./observable.js"
import { nodeStreamToObservable } from "./nodeStreamToObservable.js"

export const normalizeBodyMethods = (body) => {
  if (isObservable(body)) {
    return {
      asObservable: () => body,
      destroy: () => {},
    }
  }

  if (isFileHandle(body)) {
    return {
      asObservable: () => fileHandleToObservable(body),
      destroy: () => {
        body.close()
      },
    }
  }

  if (isNodeStream(body)) {
    return {
      asObservable: () => nodeStreamToObservable(body),
      destroy: () => {
        body.destroy()
      },
    }
  }

  return {
    asObservable: () => observableFromValue(body),
    destroy: () => {},
  }
}

export const isFileHandle = (value) => {
  return value && value.constructor && value.constructor.name === "FileHandle"
}

export const fileHandleToReadableStream = (fileHandle) => {
  const fileReadableStream =
    typeof fileHandle.createReadStream === "function"
      ? fileHandle.createReadStream()
      : createReadStream(
          "/toto", // is it ok to pass a fake path like this?
          {
            fd: fileHandle.fd,
            emitClose: true,
            // autoClose: true
          },
        )
  // I suppose it's required only when doing fs.createReadStream()
  // and not fileHandle.createReadStream()
  // fileReadableStream.on("end", () => {
  //   fileHandle.close()
  // })
  return fileReadableStream
}

const fileHandleToObservable = (fileHandle) => {
  return nodeStreamToObservable(fileHandleToReadableStream(fileHandle))
}

const isNodeStream = (value) => {
  if (value === undefined) {
    return false
  }

  if (
    value instanceof Stream ||
    value instanceof Writable ||
    value instanceof Readable
  ) {
    return true
  }

  return false
}
