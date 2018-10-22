// when any of SIGUP, SIGINT, SIGTERM, beforeExit, exit is emitted
// call a given function allowed to return a promise in case the teardown is async
// it's very usefull to ensure a given server is closed when process exits

import { asyncSimultaneousEmitter, createSignal, race } from "@dmail/signal"

export const hangupOrDeath = createSignal({
  emitter: asyncSimultaneousEmitter,
  installer: ({ emit }) => {
    // SIGHUP http://man7.org/linux/man-pages/man7/signal.7.html
    const triggerHangUpOrDeath = () => emit("hangupOrDeath")

    process.on("SIGUP", triggerHangUpOrDeath)

    return () => {
      process.removeListener("SIGUP", triggerHangUpOrDeath)
    }
  },
})

export const terminate = createSignal({
  emitter: asyncSimultaneousEmitter,
  installer: ({ emit }) => {
    // SIGINT is CTRL+C from keyboard
    // http://man7.org/linux/man-pages/man7/signal.7.html
    // may also be sent by vscode https://github.com/Microsoft/vscode-node-debug/issues/1#issuecomment-405185642
    const triggerTerminate = () => {
      emit("terminate").then(
        () => {
          process.exit(process.exitCode || 0)
        },
        (error) => {
          setTimeout(() => {
            throw error
          })
        },
      )
    }

    process.on("SIGINT", triggerTerminate)

    return () => {
      process.removeListener("SIGINT", triggerTerminate)
    }
  },
})

export const death = createSignal({
  emitter: asyncSimultaneousEmitter,
  installer: ({ emit }) => {
    // is SIGTERM handled by beforeExit ? ook at terminus module on github
    // SIGTERM http://man7.org/linux/man-pages/man7/signal.7.html
    const triggerDeath = () => emit("death")

    process.on("SIGTERM", triggerDeath)

    return () => {
      process.removeListener("SIGTERM", triggerDeath)
    }
  },
})

export const beforeExit = createSignal({
  emitter: asyncSimultaneousEmitter,
  installer: ({ emit, disableWhileCalling }) => {
    const triggerBeforeExit = () =>
      emit("beforeExit").then(() =>
        disableWhileCalling(() => {
          process.exit()
        }),
      )

    process.on("beforeExit", triggerBeforeExit)

    return () => {
      process.removeListener("beforeExit", triggerBeforeExit)
    }
  },
})

export const exit = createSignal({
  emitter: asyncSimultaneousEmitter,
  installer: ({ emit }) => {
    const triggerExit = () => {
      emit("exit")
    }

    process.on("exit", triggerExit)

    return () => {
      process.removeListener("exit", triggerExit)
    }
  },
})

const teardownSignals = [hangupOrDeath, terminate, death, beforeExit, exit]
export const processTeardown = (teardownCallback) => {
  return race(teardownSignals, ({ args }) => teardownCallback(...args))
}
