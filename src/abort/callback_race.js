/*
 * See callback_race.md
 */

export const raceCallbacks = (raceDescription, winnerCallback) => {
  const cleanCallbacks = []

  const cleanup = () => {
    const cleanCallbacksCopy = cleanCallbacks.slice()
    cleanCallbacks.length = 0
    cleanCallbacksCopy.forEach((clean) => {
      clean()
    })
  }

  Object.keys(raceDescription).forEach((candidateName) => {
    const register = raceDescription[candidateName]
    const returnValue = register((data) => {
      cleanup()
      winnerCallback({
        name: candidateName,
        data,
      })
    })
    if (typeof returnValue === "function") {
      cleanCallbacks.push(returnValue)
    }
  })

  return cleanup
}
