export const registerEvent = (object, name, callback) => {
  object.on(name, callback)
  return () => {
    object.removeListener(name, callback)
  }
}

export const registerThen = (promise, callback) => {
  let registered = true
  promise.then((value) => {
    if (registered) {
      callback(value)
    }
  })
  return () => {
    registered = false
  }
}

export const registerCatch = (promise, callback) => {
  let registered = true
  promise.catch((error) => {
    if (registered) {
      callback(error)
    }
  })
  return () => {
    registered = false
  }
}

export const eventRace = (eventMap) => {
  const unregisterMap = {}

  const unregisterAll = (reason) => {
    return Object.keys(unregisterMap).map((name) => unregisterMap[name](reason))
  }

  Object.keys(eventMap).forEach((name) => {
    const { register, callback } = eventMap[name]

    unregisterMap[name] = register((...args) => {
      unregisterAll()
      callback(...args)
    })
  })

  return unregisterAll
}
