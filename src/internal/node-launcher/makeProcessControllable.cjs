/* global require */

const { createCancellationSource } = require("@jsenv/cancellation")
const { uneval } = require("@jsenv/uneval")
const killProcessTree = require("tree-kill")

const makeProcessControllable = ({ evaluate }) => {
  const processCancellationSource = createCancellationSource()

  const EVALUATION_STATUS_OK = "evaluation-ok"
  const EVALUATION_STATUS_ERROR = "evaluation-error"

  const removeSIGTERMListener = onceSIGTERM(() => {
    // cancel will remove listener to process.on('message')
    // which is sufficient to let child process die
    // assuming nothing else keeps it alive
    processCancellationSource.cancel("process received SIGTERM")
    terminate()
  })
  processCancellationSource.token.register(removeSIGTERMListener)
  processCancellationSource.token.register(
    // parent could just do child.kill("SIGTERM"), I am just not sure
    // it is supported on windows
    listenParentOnce("gracefulStop", () => {
      removeSIGTERMListener()
      processCancellationSource.cancel("parent process asks gracefulStop")
      // emit sigterm in case the code we are running is listening for it
      process.emit("SIGTERM")
      terminate()
    }),
  )
  processCancellationSource.token.register(
    listenParentOnce("stop", () => {
      processCancellationSource.cancel("parent process asks stop")
      kill()
    }),
  )
  processCancellationSource.token.register(
    listenParentOnce("evaluate", async (expressionString) => {
      try {
        const value = await evaluate(expressionString)
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
}

const terminate = () => {
  killProcessTree(process.pid, "SIGTERM", (error) => {
    if (error) {
      console.error(`error while killing process tree with SIGTERM
--- error stack ---
${error.stack}
--- process.pid ---
${process.pid}`)
    }
  })
}

const kill = () => {
  killProcessTree(process.pid, "SIGKILL", (error) => {
    if (error) {
      console.error(`error while killing process tree with SIGKILL
--- error stack ---
${error.stack}
--- process.pid ---
${process.pid}`)
    }
  })
  process.exit()
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

const onceSIGTERM = (callback) => {
  process.once("SIGTERM", callback)
  return () => {
    process.removeListener("SIGTERM", callback)
  }
}

exports.makeProcessControllable = makeProcessControllable
