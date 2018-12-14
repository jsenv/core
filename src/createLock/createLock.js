import { arrayWithout } from "../arrayHelper.js"

export const createLockRegistry = () => {
  let lockArray = []
  const lockForRessource = async (ressource) => {
    let unlockResolve
    const unlocked = new Promise((resolve) => {
      unlockResolve = resolve
    })
    const lock = {
      ressource,
      unlocked,
    }

    lockArray = [...lockArray, lock]
    const currentLock = lockArray.find((lock) => lock.ressource === ressource)
    if (currentLock) await currentLock.unlocked

    const unlock = () => {
      lockArray = arrayWithout(lockArray, lock)
      unlockResolve()
    }
    return unlock
  }
  return { lockForRessource }
}
