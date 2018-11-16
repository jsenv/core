export const createRestartSource = () => {
  let restartImplementation
  let restartReason
  let opened = false
  let requested = false
  const restartResolveList = []

  let requestedResolve
  let requestedPromise
  const nextRequestedPromise = () => {
    requestedPromise = new Promise((resolve) => {
      requestedResolve = resolve
    })
  }
  nextRequestedPromise()

  const onOpenedAndRequested = () => {
    const sharedRestartPromise = Promise.resolve().then(() => restartImplementation(restartReason))
    restartImplementation.then(() => {
      // restart is done, next call to restart
      nextRequestedPromise()
    })
    const resolveListCopy = restartResolveList.slice()
    restartResolveList.length = 0
    resolveListCopy.forEach((resolve) => resolve(sharedRestartPromise))
  }

  const open = (callback) => {
    opened = true
    restartImplementation = callback

    if (requested) {
      onOpenedAndRequested()
    }

    return () => {
      opened = false
    }
  }

  const restart = (reason) => {
    requested = true
    restartReason = reason
    requestedResolve(reason)
    const restartPromise = new Promise((resolve) => {
      restartResolveList.push(resolve)
    })

    if (opened) {
      onOpenedAndRequested()
    }

    return restartPromise
  }

  const toRequestedPromise = () => requestedPromise

  const token = {
    toRequestedPromise,
    open,
  }

  return { restart, token }
}

export const createRestartToken = () => {
  return {
    toRequestedPromise: () => new Promise(() => {}),
    open: () => () => {},
  }
}

export const restartTokenCompose = (...restartTokens) => {
  const restartToken = {
    toRequestedPromise: () => {
      return Promise.race([restartTokens.map((restartToken) => restartToken.toRequestedPromise())])
    },
    open: (callback) => {
      const closeList = restartTokens.map((restartToken) => restartToken.open(callback))
      return () => {
        closeList.forEach((close) => close())
      }
    },
  }

  return restartToken
}
