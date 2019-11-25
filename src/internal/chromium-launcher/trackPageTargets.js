export const trackPageTargets = (page, callback) => {
  let allDestroyedRegistrationArray = []
  const pendingDestroyedPromiseArray = []
  const targetArray = []

  const trackContextTargets = (browserContext) => {
    // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-target
    browserContext.on("targetcreated", targetcreatedCallback)
    browserContext.on("targetdestroyed", targetdestroyedCallback)

    return async () => {
      browserContext.removeListener("targetcreated", targetcreatedCallback)
      browserContext.removeListener("targetdestroyed", targetdestroyedCallback)
      await Promise.all(pendingDestroyedPromiseArray)
    }
  }

  const targetcreatedCallback = async (target) => {
    targetArray.push(target)

    const type = target.type()
    if (type === "browser") {
      registerTargetDestroyed(target, trackContextTargets(target.browserContext()))
    }
    const returnValue = await callback({ target, type })
    if (typeof returnValue === "function") {
      registerTargetDestroyed(target, returnValue)
    }
  }

  const registerTargetDestroyed = (target, callback) => {
    allDestroyedRegistrationArray.push({ target, callback })
  }

  const targetdestroyedCallback = async (target) => {
    const targetIndex = targetArray.indexOf(target)
    if (targetIndex === -1) {
      console.warn("untracked target destroyed")
    } else {
      const destroyedRegistrationArray = []
      const otherDestroyedRegistrationArray = []
      destroyedRegistrationArray.forEach((destroyedRegistration) => {
        if (destroyedRegistration.target === target) {
          destroyedRegistrationArray.push(destroyedRegistration)
        } else {
          otherDestroyedRegistrationArray.push(destroyedRegistration)
        }
      })
      allDestroyedRegistrationArray = otherDestroyedRegistrationArray

      const pendingDestroyedPromise = Promise.all(
        destroyedRegistrationArray.map((destroyedRegistration) => destroyedRegistration.callback()),
      )
      pendingDestroyedPromiseArray.push(pendingDestroyedPromise)
      await pendingDestroyedPromise
      pendingDestroyedPromiseArray.splice(
        pendingDestroyedPromiseArray.indexOf(pendingDestroyedPromise),
        1,
      )
    }
  }

  return trackContextTargets(page.browserContext())
}
