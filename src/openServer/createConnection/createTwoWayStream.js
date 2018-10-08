import { createPromiseAndHooks } from "../../promise.js"
import { createSignal } from "@dmail/signal"

const twoWayStreamSymbol = Symbol.for("twoWayStream")

export const isTwoWayStream = (a) => {
  return a && typeof a === "object" && twoWayStreamSymbol in a
}

export const createTwoWayStream = () => {
  let length = 0
  let status = "opened"

  const { promise, resolve } = createPromiseAndHooks()

  const errored = createSignal({ smart: true })
  const cancelled = createSignal({ smart: true })
  const closed = createSignal({ smart: true })
  const writed = createSignal({ smart: true })

  const error = (e) => {
    status = "errored"
    errored.emit(e)
    // maybe should we reset smartMemory
    // writed.smartMemory.length = 0
    // but I think it's better to avoid doing anything in case of error
    throw e
  }

  const cancel = () => {
    if (status === "cancelled") {
      return
    }
    status = "cancelled"
    writed.smartMemory.length = 0
    length = 0
    cancelled.emit()
  }

  const close = () => {
    if (status === "closed") {
      return
    }
    status = "closed"
    resolve(writed.smartMemory.map(([buffer]) => buffer))
    closed.emit()
  }

  const write = (data) => {
    if (status === "closed") {
      throw new Error("write after end")
    }
    if (data) {
      length += data.length
      writed.emit(data)
    }
  }

  const getLength = () => length

  return Object.freeze({
    [twoWayStreamSymbol]: true,
    error,
    errored,
    cancel,
    cancelled,
    close,
    closed,
    write,
    writed,
    getLength,
    promise,
  })
}
