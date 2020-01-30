import { createCancellationSource } from "@jsenv/cancellation"
import { uneval } from "@jsenv/uneval"

const EVALUATION_STATUS_OK = "evaluation-ok"
const EVALUATION_STATUS_ERROR = "evaluation-error"

const registerProcessTerminateCallback = (callback) => {
  process.once("SIGTERM", callback)
  return () => {
    process.removeListener("SIGTERM", callback)
  }
}

const listenParentOnce = (type, callback) => {
  const listener = (event) => {
    if (event.type === type) {
      // commenting line below keep this process alive
      removeListener()
      // eslint-disable-next-line no-eval
      callback(eval(`(${event.data})`))
    }
  }

  const removeListener = () => {
    process.removeListener("message", listener)
  }

  process.on("message", listener)
  return removeListener
}

const { token, cancel } = createCancellationSource()
const removeTerminateCallback = registerProcessTerminateCallback(() => {
  // cancel will remove listener to process.on('message')
  // which is sufficient to let child process die
  // assuming nothing else keeps it alive
  cancel("process received SIGTERM")
})
token.register(removeTerminateCallback)
token.register(
  listenParentOnce("gracefulStop", () => {
    removeTerminateCallback()
    cancel("parent process asks gracefulStop")
    // emit sigterm in case the code we are running is listening for it
    process.emit("SIGTERM")
  }),
)
token.register(
  listenParentOnce("stop", () => {
    process.exit()
  }),
)
token.register(
  listenParentOnce("evaluate", async (source) => {
    try {
      // eslint-disable-next-line no-eval
      const namespace = await evalUsingDynamicImport(`${source}
  ${"//#"} sourceURL=__node-evaluation-script__.js`)
      const value = await namespace.default
      sendToParent(
        "evaluate-result",
        // here we use JSON.stringify because we should not
        // have non enumerable value (unlike there is on Error objects)
        // otherwise uneval is quite slow to turn a giant object
        // into a string (and value can be giant when using coverage)
        JSON.stringify({
          status: EVALUATION_STATUS_OK,
          value,
        }),
      )
    } catch (e) {
      sendToParent(
        "evaluate-result",
        // process.send algorithm does not send non enumerable values
        // because it works with JSON.stringify I guess so use uneval
        uneval({
          status: EVALUATION_STATUS_ERROR,
          value: e,
        }),
      )
    }
  }),
)

const evalUsingDynamicImport = async (source) => {
  const sourceAsBase64 = Buffer.from(source).toString("base64")
  const namespace = await import(`data:text/javascript;base64,${sourceAsBase64}`)
  return namespace
}

const sendToParent = (type, data) => {
  // https://nodejs.org/api/process.html#process_process_connected
  // not connected anymore, cannot communicate with parent
  if (!process.connected) {
    throw new Error("cannot send response because process not connected to parent")
  }

  // this can keep process alive longer than expected
  // when source is a long string.
  // It means node process may stay alive longer than expected
  // the time to send the data to the parent.
  process.send({
    type,
    data,
  })
}

setTimeout(() => sendToParent("ready"))
