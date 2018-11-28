import { createPromiseAndHooks } from "../../promiseHelper.js"

export const createFakePlatform = () => {
  const platform = {
    opened: createPromiseAndHooks(),
    errored: createPromiseAndHooks(),
    closed: createPromiseAndHooks(),
    executed: createPromiseAndHooks(),
    fileToExecuted: () => platform.executed,
    close: () => {},
  }

  return platform
}
