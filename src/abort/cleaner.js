import { createCallbackList } from "./callback_list.js"

export const createCleaner = () => {
  const callbackList = createCallbackList()

  const addCallback = (callback) => {
    return callbackList.add(callback)
  }

  const clean = async (reason) => {
    const callbacks = callbackList.copy()
    callbackList.clear()

    await Promise.all(
      callbacks.map(async (callback) => {
        await callback(reason)
      }),
    )
  }

  return { addCallback, clean }
}
