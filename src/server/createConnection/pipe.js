import {
  onceCanceled,
  cancel,
  onceErrored,
  error,
  onData,
  write,
  onceEnded,
  end,
} from "./interface/interface.js"

export const pipe = (
  from,
  to,
  { pipeError = true, pipeCancel = true, pipeData = true, pipeEnd = true } = {},
) => {
  if (pipeError) {
    onceErrored(from, (value) => {
      error(to, value)
    })
  }
  if (pipeCancel) {
    onceCanceled(from, (reason) => {
      cancel(to, reason)
    })
  }
  if (pipeData) {
    const removeDataListener = onData(from, (data) => {
      write(to, data)
    })
    onceErrored(from, removeDataListener)
    onceCanceled(from, removeDataListener)
    onceEnded(from, removeDataListener)
  }
  if (pipeEnd) {
    onceEnded(from, () => {
      end(to)
    })
  }
}
