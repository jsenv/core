import { race } from "@dmail/signal"

export const cancellableAction = (callback, triggerSignal, ...cancelSignals) => {
  return race([triggerSignal, ...cancelSignals], ({ index, args }) => {
    if (index === 0) {
      callback(...args)
    }
  })
}
