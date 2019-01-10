import { arrayWithout } from "../../arrayHelper.js"

export const twoWayStreamSymbol = Symbol.for("twoWayStream")

export const createTwoWayStream = () => {
  let length = 0
  let status = "pending"

  const dataArray = []
  let dataListeners = []
  const listenData = (cb) => {
    // if errored, canceled, ended, no data can emit and
    // we should not emit the current data neither
    if (status !== "pending") return () => {}

    dataListeners = [...dataListeners, cb]
    dataArray.forEach((data) => {
      cb(data)
    })
    return () => {
      dataListeners = arrayWithout(dataListeners, cb)
    }
  }

  const clear = () => {
    length = 0
    dataArray.length = 0
  }
  const write = (data) => {
    if (status === "ended") throw new Error("write after end")

    length += data.length
    dataArray.push(data)
    dataListeners.forEach((listener) => listener(data))
  }

  let error
  const errored = new Promise((resolve) => {
    error = (e) => {
      status = "errored"
      resolve(e)
      // maybe we should clear()
      // but it's better to do nothing on error I guess
      throw e
    }
  })

  let cancel
  const cancelled = new Promise((resolve) => {
    cancel = (reason) => {
      if (status === "canceled") return
      status = "canceled"
      clear()
      resolve(reason)
    }
  })

  let end
  const ended = new Promise((resolve) => {
    if (status === "ended") return
    status = "ended"
    const result = dataArray.slice()
    // clear() // should we clear ?
    resolve(result)
  })

  const getLength = () => length

  return Object.freeze({
    [twoWayStreamSymbol]: true,
    listenData,
    write,
    error,
    errored,
    cancel,
    cancelled,
    end,
    ended,
    getLength,
  })
}
