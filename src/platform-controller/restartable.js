export const createRestartSource = () => {
  let restartCallback = () => undefined

  const hook = {
    setRestartCallback: (callback) => {
      restartCallback = callback
    },
  }

  const restart = (reason) => restartCallback(reason)

  return { hook, restart }
}

export const createRestartHook = () => {
  const setRestartCallback = () => {}

  return { setRestartCallback }
}

export const createRestartable = () => {
  let howToRestart
  let opened = false
  let restartReturnValue

  let closeCallback
  const onclose = (callback) => {
    closeCallback = callback
  }
  const close = (reason) => {
    if (!opened) return
    opened = false
    howToRestart = undefined
    if (closeCallback) {
      closeCallback(reason)
    }
  }

  let openCallback
  const onopen = (callback) => {
    openCallback = callback
  }
  const open = (restartImplementation) => {
    opened = true
    howToRestart = (reason) => {
      close(`restart requested`)
      return restartImplementation(reason)
    }
    if (openCallback) {
      openCallback()
    }
  }

  const canBeRestarted = () => opened

  let restartCallback
  const onrestart = (callback) => {
    restartCallback = callback
  }
  const restart = (reason) => {
    if (!opened) throw new Error(`restart source must be opened to restart`)

    restartReturnValue = howToRestart(reason)
    if (restartCallback) {
      const callback = restartCallback
      restartCallback = undefined
      callback({ restartReason: reason, restartReturnValue })
    }
    return restartReturnValue
  }

  const addHook = (restartHook) => {
    restartHook.setRestartCallback((reason) => {
      if (canBeRestarted()) {
        return restart(reason)
      }
      return undefined
    })
  }

  return {
    onclose,
    close,
    onopen,
    open,
    onrestart,
    addHook,
  }
}
