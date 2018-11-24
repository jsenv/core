export const createRestartController = () => {
  let restartSource

  const token = {
    setRestartSource: (value) => {
      restartSource = value
    },
  }

  const restart = (reason) => {
    if (restartSource) {
      if (restartSource.canBeRestarted()) {
        return restartSource.restart(reason)
      }
      return undefined
    }
    return undefined
  }

  return { token, restart }
}

export const createRestartToken = () => {
  const setRestartSource = () => {}

  return { setRestartSource }
}

export const restartTokenCompose = (...restartTokens) => {
  const setRestartSource = (restartSource) => {
    restartTokens.forEach((restartToken) => {
      restartToken.setRestartSource(restartSource)
    })
  }

  return { setRestartSource }
}

export const createRestartSource = () => {
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
    if (opened) throw new Error(`restart source already opened`)

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

  return {
    canBeRestarted,
    onclose,
    close,
    onopen,
    open,
    onrestart,
    restart,
  }
}
