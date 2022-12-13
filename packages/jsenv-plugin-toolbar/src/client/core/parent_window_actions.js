import { parentWindowReloader } from "./parent_window_context.js"

export const sendEventToParent = (name, data) => {
  window.parent.postMessage(
    {
      __jsenv__: {
        event: name,
        data,
      },
    },
    "*",
  )
}

export const addExternalCommandCallback = (command, callback) => {
  const messageEventCallback = (messageEvent) => {
    const { data } = messageEvent
    if (typeof data !== "object") {
      return
    }
    const { __jsenv__ } = data
    if (!__jsenv__) {
      return
    }
    if (__jsenv__.command !== command) {
      return
    }
    callback(...__jsenv__.args)
  }

  window.addEventListener("message", messageEventCallback)
  return () => {
    window.removeEventListener("message", messageEventCallback)
  }
}

export const enableAutoreload = () => {
  parentWindowReloader.autoreload.enable()
}

export const disableAutoreload = () => {
  parentWindowReloader.autoreload.disable()
}
