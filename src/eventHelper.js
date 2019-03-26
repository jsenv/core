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
  const names = Object.keys(eventMap)
  const unregisterMap = {}
  let called = false

  const visit = (name) => {
    const { register, callback } = eventMap[name]

    const unregister = register((...args) => {
      called = true
      // this event unregister all other event because this one hapenned
      const otherNames = names.filter((otherName) => otherName !== name)
      otherNames.forEach((otherName) => {
        unregisterMap[otherName]()
      })
      return callback(...args)
    })

    unregisterMap[name] = unregister
  }

  let i = 0
  while (i < names.length) {
    const name = names[i]
    visit(name)
    if (called) {
      return () => {}
    }
    i++
  }

  return (reason) => {
    return Object.keys(unregisterMap).map((name) => unregisterMap[name](reason))
  }
}
