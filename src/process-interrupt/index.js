import { asyncSimultaneousEmitter, createSignal } from "@dmail/signal"

const interrupt = createSignal({
  emitter: asyncSimultaneousEmitter,
  installer: ({ emit }) => {
    // SIGINT is CTRL+C from keyboard
    // http://man7.org/linux/man-pages/man7/signal.7.html
    // may also be sent by vscode https://github.com/Microsoft/vscode-node-debug/issues/1#issuecomment-405185642
    const triggerInterrupt = () => {
      emit("interrupt")
    }

    process.on("SIGINT", triggerInterrupt)

    return () => {
      process.removeListener("SIGINT", triggerInterrupt)
    }
  },
})

export const processInterrupt = (interruptCallback) => {
  const listener = interrupt.listenOnce(() => interruptCallback)
  return () => {
    listener.remove()
  }
}
