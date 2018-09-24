import stream from "stream"
import { createPromiseAndHooks } from "../promise.js"
import { createSignal } from "@dmail/signal"

const isNodeStream = (a) => {
  if (a instanceof stream.Stream || a instanceof stream.Writable) {
    return true
  }
  return false
}

const closeStream = (stream) => {
  if (isNodeStream(stream)) {
    stream.end()
  } else {
    stream.close()
  }
}

const createTwoWayStream = () => {
  const buffers = []
  let length = 0
  let status = "opened"

  const { promise, resolve } = createPromiseAndHooks()

  const errored = createSignal({ smart: true })
  const cancelled = createSignal({ smart: true })
  const closed = createSignal({ smart: true })
  const writed = createSignal()

  const error = (e) => {
    status = "errored"
    errored.emit(e)
    throw e
  }

  const cancel = () => {
    if (status === "cancelled") {
      return
    }
    status = "cancelled"
    buffers.length = 0
    length = 0
    cancelled.emit()
  }

  const close = () => {
    if (status === "closed") {
      return
    }
    status = "closed"
    resolve(buffers)
    closed.emit()
  }

  const write = (data) => {
    buffers.push(data)
    length += data.length
    writed.emit(data)
  }

  const pipeTo = (
    stream,
    {
      propagateData = true,
      propagateCancel = true,
      propagateClose = true,
      propagateError = true,
    } = {},
  ) => {
    if (propagateCancel) {
      cancelled.listenOnce(() => {
        stream.cancel()
      })
    }
    if (propagateError) {
      errored.listenOnce((error) => {
        stream.error(error)
      })
    }
    if (propagateData) {
      if (length) {
        buffers.forEach((buffer) => {
          stream.write(buffer)
        })
      }
      writed.listen((buffer) => {
        stream.write(buffer)
      })
    }
    if (propagateClose) {
      closed.listenOnce(() => {
        closeStream(stream)
      })
    }

    return stream
  }

  return Object.freeze({
    error,
    errored,
    cancel,
    cancelled,
    close,
    closed,
    write,
    writed,
    pipeTo,
    promise,
  })
}

const stringToArrayBuffer = (string) => {
  string = String(string)
  const buffer = new ArrayBuffer(string.length * 2) // 2 bytes for each char
  const bufferView = new Uint16Array(buffer)
  let i = 0
  while (i < string.length) {
    bufferView[i] = string.charCodeAt(i)
    i++
  }
  return buffer
}

export const createBody = (data) => {
  const twoWayStream = createTwoWayStream()

  if (data !== undefined) {
    if (isNodeStream(data)) {
      const nodeStream = data

      // nodeStream.resume() ?
      nodeStream.once("error", (error) => {
        twoWayStream.error(error)
      })
      nodeStream.on("data", (data) => {
        twoWayStream.write(data)
      })
      nodeStream.once("end", () => {
        twoWayStream.close()
      })
    } else if (data && data.pipeTo) {
      data.pipeTo(twoWayStream)
    } else {
      twoWayStream.write(data)
    }
  }

  const readAsString = () => {
    return twoWayStream.promise.then((buffers) => buffers.join(""))
  }

  const text = () => {
    return readAsString()
  }

  const arraybuffer = () => {
    return text().then(stringToArrayBuffer)
  }

  const json = () => {
    return text().then(JSON.parse)
  }

  return {
    ...twoWayStream,
    text,
    arraybuffer,
    json,
  }
}
