export const createRessource = ({ share = false, start, stop }) => {
  if (!share) {
    let ressource
    const startUsing = (...args) => {
      ressource = start(...args)

      const stopUsing = () => {
        const value = ressource
        ressource = undefined
        return stop(value)
      }

      return { ressource, stopUsing }
    }

    return { startUsing }
  }

  const cacheMap = {}

  const startUsing = (...args) => {
    const cacheId = argsToId(args)

    let cache
    if (cacheId in cacheMap) {
      cache = cacheMap[cacheId]
    } else {
      cache = {
        useCount: 0,
        ressource: undefined,
      }
      cacheMap[cacheId] = cache
    }

    if (cache.useCount === 0) {
      cache.ressource = start(...args)
    }
    cache.useCount++

    let stopped = false
    let stopUsingReturnValue

    const stopUsing = () => {
      if (stopped) {
        // in case stopUsing is called more than once
        return stopUsingReturnValue
      }

      stopped = true

      cache.useCount--
      if (cache.useCount === 0) {
        const value = cache.ressource
        cache.ressource = undefined
        delete cacheMap[cacheId]
        stopUsingReturnValue = stop(value)
        return stopUsingReturnValue
      }

      stopUsingReturnValue = undefined
      return stopUsingReturnValue
    }

    return {
      ressource: cache.ressource,
      stopUsing,
    }
  }

  return { startUsing }
}

const argsToId = (args) => JSON.stringify(args)
