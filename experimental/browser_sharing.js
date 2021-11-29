export const createSharedValue = ({ argsToId = argsToIdFallback } = {}) => {
  const tokenMap = {}

  const getSharingToken = (...args) => {
    const id = argsToId(args)

    if (id in tokenMap) {
      return tokenMap[id]
    }

    const sharingToken = createSharingToken({
      unusedCallback: () => {
        delete tokenMap[id]
      },
    })
    tokenMap[id] = sharingToken
    return sharingToken
  }

  const getUniqueSharingToken = () => {
    return createSharingToken()
  }

  return { getSharingToken, getUniqueSharingToken }
}

const createSharingToken = ({ unusedCallback = () => {} } = {}) => {
  let useCount = 0
  let sharedValue
  let cleanup
  const sharingToken = {
    isUsed: () => useCount > 0,

    setSharedValue: (value, cleanupFunction = () => {}) => {
      sharedValue = value
      cleanup = cleanupFunction
    },

    useSharedValue: () => {
      useCount++

      let stopped = false
      let stopUsingReturnValue
      const stopUsing = () => {
        // ensure if stopUsing is called many times
        // it returns the same value and does not decrement useCount more than once
        if (stopped) {
          return stopUsingReturnValue
        }

        stopped = true
        useCount--
        if (useCount === 0) {
          unusedCallback()
          sharedValue = undefined
          stopUsingReturnValue = cleanup()
        } else {
          stopUsingReturnValue = undefined
        }

        return stopUsingReturnValue
      }

      return [sharedValue, stopUsing]
    },
  }
  return sharingToken
}

const argsToIdFallback = (args) => JSON.stringify(args)
