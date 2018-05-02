import { createAsyncSignal, createEmitter, someAsyncListenerReturns } from "@dmail/signal"

const exceptionEmitter = createEmitter({
  visitor: (param) => {
    let resolveNow
    const shortcircuitPromise = new Promise((resolve) => {
      resolveNow = resolve
    })
    const someListenerReturnsTrue = someAsyncListenerReturns((value) => value === true)(param)
    const oneOfPromise = Promise.race([shortcircuitPromise, someListenerReturnsTrue])
    oneOfPromise.shortcircuit = resolveNow
    return oneOfPromise
  },
})

const createAddExceptionHandler = ({ install }) => {
  const exceptionSignal = createAsyncSignal({
    emitter: exceptionEmitter,
    recursed: ({ emitExecution, args }) => {
      console.error(`${args[0].value} error occured while handling ${emitExecution.args[0]}`)
      emitExecution.shortcircuit(false)
    },
    installer: ({ isEmitting, getEmitExecution, emit, disableWhileCalling }) => {
      const triggerException = (exception) => {
        emit(exception).then(
          (recovered) => {
            if (recovered) {
              return
            }
            // removeAllWhileCalling prevent catching of the next throw
            // else the following would create an infinite loop
            // process.on('uncaughtException', function() {
            //     setTimeout(function() {
            //         throw 'yo';
            //     });
            // });
            disableWhileCalling(() => {
              throw exception.value // this mess up the stack trace :'(
            })
          },
          (otherException) => {
            console.error(`${otherException} internal error occured while handling ${exception}`)
            disableWhileCalling(() => {
              throw exception.value
            })
          },
        )
      }

      const recoverWhen = (match) => {
        if (isEmitting()) {
          const emitExecution = getEmitExecution()
          if (match(...emitExecution.getArguments())) {
            emitExecution.shortcircuit(true)
          }
        }
      }

      return install({
        triggerException,
        recoverWhen,
      })
    },
  })

  return exceptionSignal.listen
}

export const addNodeExceptionHandler = createAddExceptionHandler({
  install: ({ triggerException, recoverWhen }) => {
    const onError = (error) => {
      triggerException({
        value: error,
      })
    }

    const onUnhandledRejection = (value, promise) => {
      triggerException({
        value,
        origin: promise,
      })
    }

    const onRejectionHandled = (promise) => {
      recoverWhen(({ origin }) => origin === promise)
    }

    process.on("unhandledRejection", onUnhandledRejection)
    process.on("rejectionHandled", onRejectionHandled)
    process.on("uncaughtException", onError)

    return () => {
      process.removeListener("unhandledRejection", onUnhandledRejection)
      process.removeListener("rejectionHandled", onRejectionHandled)
      process.removeListener("uncaughtException", onError)
    }
  },
})
