export const createLockRegistry = () => {
  let lockArray = []
  const lockForResource = async (resource) => {
    const currentLock = lockArray.find((lock) => lock.resource === resource)
    let unlockResolve
    const unlocked = new Promise((resolve) => {
      unlockResolve = resolve
    })
    const lock = {
      resource,
      unlocked,
    }
    lockArray = [...lockArray, lock]

    if (currentLock) await currentLock.unlocked

    const unlock = () => {
      lockArray = lockArray.filter((lockCandidate) => lockCandidate !== lock)
      unlockResolve()
    }
    return unlock
  }
  return { lockForResource }
}
