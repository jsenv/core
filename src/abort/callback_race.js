/*
 * See callback_race.md
 */

export const raceCallbacks = (raceDescription, winnerCallback) => {
  const cleanCallbacks = []
  let done = false

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
      if (done) return
      done = true
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
