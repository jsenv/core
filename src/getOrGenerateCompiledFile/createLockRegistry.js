import { arrayWithoutValue } from "@dmail/helper"

export const createLockRegistry = () => {
  let lockArray = []
  const lockForRessource = async (ressource) => {
    const currentLock = lockArray.find((lock) => lock.ressource === ressource)
    let unlockResolve
    const unlocked = new Promise((resolve) => {
      unlockResolve = resolve
    })
    const lock = {
      ressource,
      unlocked,
    }
    lockArray = [...lockArray, lock]

    if (currentLock) await currentLock.unlocked

    const unlock = () => {
      lockArray = arrayWithoutValue(lockArray, lock)
      unlockResolve()
    }
    return unlock
  }
  return { lockForRessource }
}
