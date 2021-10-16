const fileCallbackMap = new Map()
// let isIdle = false
let idleTimeout

export const setFileIdleCallback = (fileUrl, asyncFunction) => {
  fileCallbackMap.set(fileUrl, asyncFunction)

  clearTimeout(idleTimeout)
  idleTimeout = setTimeout(() => {
    // isIdle = true

    const callbacks = Array.from(fileCallbackMap.values())
    fileCallbackMap.clear()
    callbacks.forEach((callback) => {
      callback()
    })
  }, 100)
  idleTimeout.unref()

  return () => {
    fileCallbackMap.delete(fileUrl)
  }
}
