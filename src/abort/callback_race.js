/*
 * Taking different code paths based on different inputs is messy
 * and code oftens forget to clean things behind itself
 * "raceCallbacks" helps to do both properly with the following API:
 *
 * const winnerPromise = raceCallbacks({
 *   timeout: (cb) => {
 *     const timeout = setTimeout(cb, 1000)
 *     return () => {
 *       clearTimeout(timeout)
 *     }
 *   },
 *   error: () => {
 *     something.on('error', cb)
 *     return () => {
 *        return something.removeListener('error', cb)
 *     }
 *   },
 *   end: () => {
 *     something.on('end', cb)
 *     return () => {
 *        return something.removeListener('end', cb)
 *     }
 *   }
 * })
 *
 * // do stuff
 *
 * const winner = await winnerPromise
 * {
 *   timeout: () => console.log('timeout after 1000ms'),
 *   error: (e) => console.error('error', e),
 *   end: (value) => console.log('end', value)
 * }[winner.name](winner.value)
 *
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
